from flask import Flask, request, jsonify
import pickle
import numpy as np
from flask_cors import CORS
from scipy import stats

app = Flask(__name__)
CORS(app)

# Load trained models, encoder, and symptoms list
try:
    svm_model = pickle.load(open("svm_model.pkl", "rb"))
    nb_model = pickle.load(open("nb_model.pkl", "rb"))
    rf_model = pickle.load(open("rf_model.pkl", "rb"))
    encoder = pickle.load(open("encoder.pkl", "rb"))

    with open("symptoms.pkl", "rb") as f:
        valid_symptoms = pickle.load(f)

    with open("disease_symptom_map.pkl", "rb") as f:
        disease_symptom_map = pickle.load(f)  # Load disease to symptoms mapping

    print("✅ Models and data loaded successfully!")

except Exception as e:
    print(f"❌ Error loading models or symptoms.pkl: {e}")

@app.route("/api/get_symptoms", methods=["GET"])
def get_symptoms():
    """Return the list of symptoms to the frontend."""
    if not valid_symptoms:
        return jsonify({"error": "Symptoms data not found."}), 500
    return jsonify({"symptoms": valid_symptoms})

@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        # Get user symptoms from request
        user_symptoms = request.json.get('symptoms', [])

        # Validate symptoms
        filtered_symptoms = [symptom for symptom in user_symptoms if symptom in valid_symptoms]
        if not filtered_symptoms:
            return jsonify({"error": "No valid symptoms provided."}), 400

        # Convert symptoms into a binary feature array
        symptoms_array = [1 if symptom in filtered_symptoms else 0 for symptom in valid_symptoms]

        # Predict with all three models
        svm_pred = svm_model.predict([symptoms_array])
        nb_pred = nb_model.predict([symptoms_array])
        rf_pred = rf_model.predict([symptoms_array])

        # Compute the mode of the predictions
        final_pred = stats.mode([svm_pred[0], nb_pred[0], rf_pred[0]], keepdims=True).mode[0]

        # Decode the predicted disease
        disease_name = encoder.inverse_transform([final_pred])[0]

        # Find other possible diseases with similar symptoms
        possible_diseases = []
        for disease, symptoms in disease_symptom_map.items():
            if any(sym in filtered_symptoms for sym in symptoms):
                possible_diseases.append(disease)

        # If multiple diseases match, ask for additional symptoms
        if len(possible_diseases) > 1:
            distinguishing_symptoms = set()
            for disease in possible_diseases:
                distinguishing_symptoms.update(disease_symptom_map[disease])

            # Remove already provided symptoms
            distinguishing_symptoms.difference_update(filtered_symptoms)

            return jsonify({
                "possible_diseases": possible_diseases,
                "ask_more_symptoms": list(distinguishing_symptoms)[:3]  # Ask about 3 more symptoms
            })

        return jsonify({'disease': disease_name})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
