from flask import Flask, request, jsonify
import pickle
import numpy as np
from flask_cors import CORS
from scipy import stats
import pandas as pd
import random

app = Flask(__name__)
CORS(app)

# Load models and data
try:
    svm_model = pickle.load(open("svm_model.pkl", "rb"))
    nb_model = pickle.load(open("nb_model.pkl", "rb"))
    rf_model = pickle.load(open("rf_model.pkl", "rb"))
    encoder = pickle.load(open("encoder.pkl", "rb"))
    with open("symptoms.pkl", "rb") as f:
        valid_symptoms = pickle.load(f)
    with open("disease_symptom_map.pkl", "rb") as f:
        disease_symptom_map = pickle.load(f)
    print("✅ Models and data loaded successfully!")
except Exception as e:
    print(f"❌ Error loading models or data: {e}")

@app.route('/api/get_symptoms', methods=['GET'])
def get_symptoms():
    try:
        return jsonify({"symptoms": valid_symptoms})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid or missing JSON request body"}), 400

        user_symptoms = data.get('symptoms', [])
        additional_symptoms = data.get('additional_symptoms', [])
        if not isinstance(user_symptoms, list) or not isinstance(additional_symptoms, list):
            return jsonify({"error": "Symptoms must be provided as a list"}), 400

        all_symptoms = list(set(user_symptoms + additional_symptoms))
        filtered_symptoms = [symptom for symptom in all_symptoms if symptom in valid_symptoms]

        # Condition 3: No valid symptoms provided
        if not filtered_symptoms:
            return jsonify({
                "message": "None of the provided symptoms match known symptoms. Please consult the chatbot for help.",
                "chatbot_suggested": True
            }), 400

        # Predict using ML models
        symptoms_dict = {symptom: 1 if symptom in filtered_symptoms else 0 for symptom in valid_symptoms}
        symptoms_array = pd.DataFrame([symptoms_dict])
        svm_pred = svm_model.predict(symptoms_array)
        nb_pred = nb_model.predict(symptoms_array)
        rf_pred = rf_model.predict(symptoms_array)
        final_pred = stats.mode([svm_pred[0], nb_pred[0], rf_pred[0]], axis=None).mode
        if isinstance(final_pred, np.ndarray):
            final_pred = final_pred[0]
        disease_name = encoder.inverse_transform([final_pred])[0]

        # Filter possible diseases: must match ALL provided symptoms
        possible_diseases = [
            disease for disease, symptoms in disease_symptom_map.items()
            if all(sym in symptoms for sym in filtered_symptoms)
        ]
        print(f"Filtered possible diseases: {possible_diseases}")

        # Condition 2: No disease matches all symptoms
        if not possible_diseases:
            return jsonify({
                "message": "No disease matches all provided symptoms. Please consult the chatbot for help.",
                "chatbot_suggested": True,
                "predicted_disease": disease_name  # ML fallback for reference
            })

        if len(possible_diseases) == 1:
            return jsonify({'disease': possible_diseases[0]})

        # Condition 1: Two or more symptoms, ask up to 3 random symptoms
        if len(filtered_symptoms) >= 2:
            distinguishing_symptoms = set()
            for disease in possible_diseases:
                distinguishing_symptoms.update(disease_symptom_map[disease])
            distinguishing_symptoms.difference_update(filtered_symptoms)

            if distinguishing_symptoms:
                # Pick up to 3 random symptoms
                ask_symptoms = random.sample(
                    list(distinguishing_symptoms),
                    min(3, len(distinguishing_symptoms))
                )
                return jsonify({
                    "possible_diseases": possible_diseases,
                    "ask_more_symptoms": ask_symptoms
                })

        # Default case: One symptom or no refinement needed
        distinguishing_symptoms = set()
        for disease in possible_diseases:
            distinguishing_symptoms.update(disease_symptom_map[disease])
        distinguishing_symptoms.difference_update(filtered_symptoms)

        if not distinguishing_symptoms:
            return jsonify({'disease': disease_name})

        one_symptom = random.choice(list(distinguishing_symptoms))
        return jsonify({
            "possible_diseases": possible_diseases,
            "ask_more_symptoms": [one_symptom]
        })

    except Exception as e:
        print("❌ Error in /predict:", str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)