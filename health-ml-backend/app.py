from flask import Flask, request, jsonify
import pickle
import numpy as np
from flask_cors import CORS
from scipy import stats
import pandas as pd
import random
import google.generativeai as genai
from dotenv import load_dotenv
import os
import time
from pymongo import MongoClient
import json
import re

app = Flask(__name__)

frontend_origin = os.getenv("FRONTEND_ORIGIN")
CORS(app, resources={r"/*": {"origins": frontend_origin}})



# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")  # e.g., mongodb://localhost:27017/lifeline
genai.configure(api_key=GEMINI_API_KEY)

# MongoDB connection
client = MongoClient(MONGO_URI)
db = client["lifeline"]
users_collection = db["users"]

try:
    client.server_info()  # Test connection
    print("✅ Connected to MongoDB Atlas")
except Exception as e:
    print(f"❌ MongoDB connection failed: {str(e)}")

# Load models and data
try:
    svm_model = pickle.load(open("svm_model.pkl", "rb"))
    nb_model = pickle.load(open("nb_model.pkl", "rb"))
    rf_model = pickle.load(open("rf_model.pkl", "rb"))
    encoder = pickle.load(open("encoder.pkl", "rb"))
    with open("symptoms.pkl", "rb") as f:
        valid_symptoms = pickle.load(f)
        print("Loaded symptoms:", valid_symptoms[:5])
    with open("disease_symptom_map.pkl", "rb") as f:
        disease_symptom_map = pickle.load(f)
    print("✅ Models and data loaded successfully!")
except Exception as e:
    print(f"❌ Error loading models or data: {e}")
    valid_symptoms = []
    disease_symptom_map = {}

def get_gemini_disease_details(disease_name, symptoms):
    prompt = (
        f"Provide concise, practical information about {disease_name} based on symptoms: {', '.join(symptoms)}. "
        "Return a JSON object with: 'description' (a short summary in 2-3 full sentences), "
        "'causes' (2-4 full-sentence reasons), 'precautions' (2-4 full-sentence suggestions), "
        "'medicines' (2-4 full-sentence self-care options). Use plain language, avoid prefixes like '-' or '*', "
        "and ensure all items are complete sentences."
    )
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")  # Switch to Flash
        response = model.generate_content(prompt)
        raw_text = response.text.strip()
        print(f"Raw Gemini response: {raw_text}")
        # Remove markdown code block if present
        if raw_text.startswith("```json") and raw_text.endswith("```"):
            raw_text = raw_text[7:-3].strip()
        details = json.loads(raw_text)
        # Minimal validation to preserve Gemini output
        if not isinstance(details.get("description"), str):
            details["description"] = f"{disease_name} is linked to symptoms like {', '.join(symptoms)}."
        for key in ["causes", "precautions", "medicines"]:
            if not isinstance(details.get(key), list) or len(details[key]) < 2:
                details[key] = [
                    f"{key.capitalize()} details for {disease_name} could not be fully retrieved.",
                    "Consult a healthcare provider for more information."
                ]
            # Clean up and ensure full sentences
            details[key] = [str(item).strip() for item in details[key][:4]]
            details[key] = [item if item.endswith('.') else item + '.' for item in details[key]]
        print(f"Processed details: {json.dumps(details, indent=2)}")
        return details
    except Exception as e:
        print(f"❌ Error fetching Gemini details: {str(e)}")
        return {
            "description": f"{disease_name} is a condition related to symptoms like {', '.join(symptoms)}.",
            "causes": ["The exact cause is unclear from limited data.", "It may be due to environmental factors."],
            "precautions": ["Keep affected areas clean to avoid worsening.", "Monitor symptoms for changes."],
            "medicines": ["Use over-the-counter remedies suitable for {disease_name}.", "Ask a pharmacist for advice."]
        }

@app.route('/api/get_symptoms', methods=['GET'])
def get_symptoms():
    try:
        if not valid_symptoms:
            raise ValueError("Symptoms data not loaded")
        print("Serving /api/get_symptoms")
        return jsonify({"symptoms": valid_symptoms})
    except Exception as e:
        print(f"Error in get_symptoms: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    start_time = time.time()
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid or missing JSON request body"}), 400
        user_symptoms = data.get('symptoms', [])
        additional_symptoms = data.get('additional_symptoms', [])
        refinement_count = data.get('refinement_count', 0)
        username = data.get('username')  # Add username for history
        print(f"Received payload: {data}")
        print(f"Parsed: user_symptoms={user_symptoms}, additional_symptoms={additional_symptoms}, refinement_count={refinement_count}")

        if not isinstance(user_symptoms, list) or not isinstance(additional_symptoms, list):
            return jsonify({"error": "Symptoms must be provided as a list"}), 400

        all_symptoms = list(set(user_symptoms + additional_symptoms))
        filtered_symptoms = [symptom for symptom in all_symptoms if symptom in valid_symptoms]
        print(f"Filtered symptoms: {filtered_symptoms}")

        if not filtered_symptoms:
            return jsonify({"message": "No valid symptoms provided", "chatbot_suggested": True}), 400

        symptoms_dict = {symptom: 1 if symptom in filtered_symptoms else 0 for symptom in valid_symptoms}
        symptoms_array = pd.DataFrame([symptoms_dict])
        svm_pred = svm_model.predict(symptoms_array)
        nb_pred = nb_model.predict(symptoms_array)
        rf_pred = rf_model.predict(symptoms_array)
        final_pred = stats.mode([svm_pred[0], nb_pred[0], rf_pred[0]], axis=None).mode
        disease_name = encoder.inverse_transform([final_pred])[0]
        print(f"Model prediction: {disease_name}")

        possible_diseases = [
            disease for disease, symptoms in disease_symptom_map.items()
            if all(sym in symptoms for sym in filtered_symptoms)
        ]
        print(f"Filtered possible diseases: {possible_diseases}")

        if len(possible_diseases) == 1:
            final_disease = possible_diseases[0]
            if username:  # Save to history
                users_collection.update_one(
                    {"name": username},
                    {"$push": {"predictionHistory": {"$each": [{"disease": final_disease, "symptoms": filtered_symptoms}], "$slice": -10}}}
                )
            print(f"Single disease prediction completed in {time.time() - start_time:.2f} seconds")
            return jsonify({"disease": final_disease})

        if refinement_count >= 3:
            if username:  # Save to history
                users_collection.update_one(
                    {"name": username},
                    {"$push": {"predictionHistory": {"$each": [{"disease": disease_name, "symptoms": filtered_symptoms}], "$slice": -10}}}
                )
            print(f"Refinements exhausted (count: {refinement_count}), selecting most suitable disease based on model: {disease_name}")
            print(f"Prediction completed in {time.time() - start_time:.2f} seconds")
            return jsonify({"disease": disease_name})

        distinguishing_symptoms = set()
        for disease in possible_diseases:
            distinguishing_symptoms.update(disease_symptom_map[disease])
        distinguishing_symptoms.difference_update(set(filtered_symptoms))
        print(f"Distinguishing symptoms: {distinguishing_symptoms}")

        if not distinguishing_symptoms:
            if username:  # Save to history
                users_collection.update_one(
                    {"name": username},
                    {"$push": {"predictionHistory": {"$each": [{"disease": disease_name, "symptoms": filtered_symptoms}], "$slice": -10}}}
                )
            print(f"No distinguishing symptoms left, selecting model prediction: {disease_name}")
            return jsonify({"disease": disease_name})

        one_symptom = random.choice(list(distinguishing_symptoms))
        print(f"Refinement step completed in {time.time() - start_time:.2f} seconds, asking: {one_symptom}")
        return jsonify({"possible_diseases": possible_diseases, "ask_more_symptoms": [one_symptom]})

    except Exception as e:
        print(f"❌ Error in /predict: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/details', methods=['POST'])
def get_details():
    start_time = time.time()
    try:
        data = request.get_json()
        if not data or 'disease' not in data or 'symptoms' not in data:
            return jsonify({"error": "Invalid request: 'disease' and 'symptoms' are required"}), 400
        disease = data['disease']
        symptoms = data['symptoms']
        print(f"Fetching details for {disease} with symptoms: {symptoms}")
        details = get_gemini_disease_details(disease, symptoms)
        print(f"Details fetched in {time.time() - start_time:.2f} seconds")
        return jsonify(details)
    except Exception as e:
        print(f"❌ Error in /details: {str(e)}")
        return jsonify({
            "description": "Failed to retrieve details for this request.",
            "causes": ["An error occurred during processing."],
            "precautions": ["Try again or seek professional advice."],
            "medicines": ["No treatment info available due to an error."]
        }), 500
    

def get_chatbot_response(user_input):
    prompt = (
        f"You are a helpful medical chatbot. The user says: '{user_input}'. "
        f"Respond conversationally, suggesting possible symptoms or actions based on this input. "
        f"If the user is unsure, suggest common symptoms like itching, skin rash, or fever. "
        f"Keep it simple, friendly, under 100 words, and avoid Markdown formatting (e.g., no * or **)."
    )
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        raw_response = response.text.strip()
        # Clean up Markdown artifacts
        cleaned_response = re.sub(r'[*_]{1,2}', '', raw_response)  # Remove *, **, _, __
        print(f"Raw response: {raw_response}")
        print(f"Cleaned response: {cleaned_response}")
        return cleaned_response
    except Exception as e:
        print(f"❌ Error in chatbot response: {str(e)}")
        return "I’m here to help! Try asking about symptoms like itching or fever—do any apply to you?"
# Existing endpoints unchanged: /api/get_symptoms, /api/predict, /api/details, /api/history, /auth/login, /auth/signup

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({"error": "Message is required"}), 400
        user_input = data['message']
        print(f"Chatbot received: {user_input}")
        response = get_chatbot_response(user_input)
        print(f"Chatbot response: {response}")
        return jsonify({"response": response})
    except Exception as e:
        print(f"❌ Error in /chat: {str(e)}")
        return jsonify({"response": "Sorry, I couldn’t process that! Try asking about symptoms."}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({"error": "Username is required"}), 400
        user = users_collection.find_one({"name": username}, {"predictionHistory": 1, "_id": 0})
        if not user or "predictionHistory" not in user:
            return jsonify({"history": []}), 200
        history = user["predictionHistory"][-10:]  # Last 10 entries
        return jsonify({"history": history})
    except Exception as e:
        print(f"❌ Error in /history: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=True, port=port, host="0.0.0.0")
