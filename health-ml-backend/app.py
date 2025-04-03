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

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

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
    start_time = time.time()
    try:
        prompt = (
            f"Provide details for {disease_name} based on symptoms: {', '.join(symptoms)}. "
            "Format the response as follows:\n"
            "- Description: 2-3 concise sentences with proper punctuation.\n"
            "- Causes: 2-3 bullet points.\n"
            "- Precautions/Suggestions: 4-5 bullet points.\n"
            "- Medicines: Relevant medicines based on the disease and symptoms."
        )
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        print(f"Raw Gemini response: {text}")

        details = {
            "description": "Details unavailable.",
            "causes": ["- Unknown"],
            "precautions": ["- Consult a doctor."],
            "medicines": ["- Consult a doctor."]
        }

        if "Description:" in text:
            desc = text.split("Description:")[1].split("Causes:")[0].strip() if "Causes:" in text else text.split("Description:")[1].strip()
            details["description"] = desc[:200] + "..." if len(desc) > 200 else desc

        if "Causes:" in text and "Precautions:" in text:
            causes_text = text.split("Causes:")[1].split("Precautions:")[0]
            causes = [line.strip() for line in causes_text.split("\n") if line.strip().startswith("-")][:3]
            details["causes"] = causes if causes else ["- Unknown"]

        if "Precautions:" in text and "Medicines:" in text:
            precautions_text = text.split("Precautions:")[1].split("Medicines:")[0]
            precautions = [line.strip() for line in precautions_text.split("\n") if line.strip().startswith("-")][:5]
            details["precautions"] = precautions if precautions else ["- Consult a doctor."]

        if "Medicines:" in text:
            medicines_text = text.split("Medicines:")[1]
            medicines = [line.strip() for line in medicines_text.split("\n") if line.strip().startswith("-")]
            details["medicines"] = medicines if medicines else ["- Consult a doctor."]
    except Exception as e:
        details = {
            "description": f"Unable to fetch details due to an error: {str(e)}. Please try again.",
            "causes": ["- Unknown"],
            "precautions": ["- Consult a healthcare professional."],
            "medicines": ["- Consult a doctor."]
        }
    print(f"Gemini API call took {time.time() - start_time:.2f} seconds")
    return details

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
        print(f"Received payload: {data}")
        print(f"Parsed: user_symptoms={user_symptoms}, additional_symptoms={additional_symptoms}, refinement_count={refinement_count}")
        if not isinstance(user_symptoms, list) or not isinstance(additional_symptoms, list):
            return jsonify({"error": "Symptoms must be provided as a list"}), 400

        all_symptoms = list(set(user_symptoms + additional_symptoms))
        filtered_symptoms = [symptom for symptom in all_symptoms if symptom in valid_symptoms]
        print(f"Filtered symptoms: {filtered_symptoms}")

        if not filtered_symptoms:
            return jsonify({"message": "No valid symptoms provided", "chatbot_suggested": True}), 400

        # Model prediction (always compute this first)
        symptoms_dict = {symptom: 1 if symptom in filtered_symptoms else 0 for symptom in valid_symptoms}
        symptoms_array = pd.DataFrame([symptoms_dict])
        svm_pred = svm_model.predict(symptoms_array)
        nb_pred = nb_model.predict(symptoms_array)
        rf_pred = rf_model.predict(symptoms_array)
        final_pred = stats.mode([svm_pred[0], nb_pred[0], rf_pred[0]], axis=None).mode
        disease_name = encoder.inverse_transform([final_pred])[0]
        print(f"Model prediction: {disease_name}")

        # Filter possible diseases
        possible_diseases = [
            disease for disease, symptoms in disease_symptom_map.items()
            if all(sym in symptoms for sym in filtered_symptoms)
        ]
        print(f"Filtered possible diseases: {possible_diseases}")

        # Predict if single disease matches
        if len(possible_diseases) == 1:
            final_disease = possible_diseases[0]
            print(f"Single disease prediction completed in {time.time() - start_time:.2f} seconds")
            return jsonify({"disease": final_disease})

        # Force a single disease prediction after 3 refinements
        if refinement_count >= 3:
            print(f"Refinements exhausted (count: {refinement_count}), selecting most suitable disease based on model: {disease_name}")
            print(f"Prediction completed in {time.time() - start_time:.2f} seconds")
            return jsonify({"disease": disease_name})

        # Calculate distinguishing symptoms for refinement
        distinguishing_symptoms = set()
        for disease in possible_diseases:
            distinguishing_symptoms.update(disease_symptom_map[disease])
        distinguishing_symptoms.difference_update(set(filtered_symptoms))
        print(f"Distinguishing symptoms: {distinguishing_symptoms}")

        # If no distinguishing symptoms remain, use model prediction
        if not distinguishing_symptoms:
            print(f"No distinguishing symptoms left, selecting model prediction: {disease_name}")
            return jsonify({"disease": disease_name})

        # Ask for more symptoms if refinements are not exhausted
        one_symptom = random.choice(list(distinguishing_symptoms))
        print(f"Refinement step completed in {time.time() - start_time:.2f} seconds, asking: {one_symptom}")
        return jsonify({"possible_diseases": possible_diseases, "ask_more_symptoms": [one_symptom]})

    except Exception as e:
        print(f"❌ Error in /predict: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/details', methods=['POST'])
def get_details():
    try:
        data = request.get_json()
        disease = data.get('disease')
        symptoms = data.get('symptoms', [])
        if not disease or not isinstance(symptoms, list):
            print(f"Invalid request: disease={disease}, symptoms={symptoms}")
            return jsonify({"error": "Missing disease or invalid symptoms"}), 400
        details = get_gemini_disease_details(disease, symptoms)
        return jsonify(details)
    except Exception as e:
        print(f"❌ Error in /details: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)