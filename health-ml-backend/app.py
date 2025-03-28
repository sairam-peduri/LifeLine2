from flask import Flask, request, jsonify
import pickle
import numpy as np
import pandas as pd
from flask_cors import CORS
from scipy import stats

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
        print("Fetching symptoms...")
        return jsonify({"symptoms": valid_symptoms})  # Ensure 'valid_symptoms' is defined
    except Exception as e:
        print(f"❌ Error in /get_symptoms: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        # Get JSON data
        print("Received predict request")
        data = request.get_json()
        print(f"Request data: {data}")
        if not data:
            return jsonify({"error": "Invalid or missing JSON request body"}), 400

        # Extract symptoms from request
        user_symptoms = data.get('symptoms', [])
        additional_symptoms = data.get('additional_symptoms', [])
        print(f"User symptoms: {user_symptoms}, Additional symptoms: {additional_symptoms}")

        if not isinstance(user_symptoms, list) or not isinstance(additional_symptoms, list):
            print("Symptoms are not lists")
            return jsonify({"error": "Symptoms must be provided as a list"}), 400

        all_symptoms = list(set(user_symptoms + additional_symptoms))  # Remove duplicates

        # Validate symptoms
        filtered_symptoms = [symptom for symptom in all_symptoms if symptom in valid_symptoms]
        print(f"Filtered symptoms: {filtered_symptoms}")
        if not filtered_symptoms:
            print("No valid symptoms found")
            return jsonify({"error": "No valid symptoms provided."}), 400

        # Create a DataFrame with feature names
        symptoms_dict = {symptom: 1 if symptom in filtered_symptoms else 0 for symptom in valid_symptoms}
        symptoms_df = pd.DataFrame([symptoms_dict])
        print("Symptoms DataFrame created")

        # Predict using all models
        svm_pred = svm_model.predict(symptoms_df)
        nb_pred = nb_model.predict(symptoms_df)
        rf_pred = rf_model.predict(symptoms_df)
        print(f"Predictions - SVM: {svm_pred}, NB: {nb_pred}, RF: {rf_pred}")

        # Compute the mode of the predictions
        final_pred = stats.mode([svm_pred[0], nb_pred[0], rf_pred[0]], axis=None).mode

        # Ensure final_pred is an array before decoding
        if isinstance(final_pred, np.ndarray):
            final_pred = final_pred[0]
        print(f"Final prediction (encoded): {final_pred}")

        # Decode predicted disease
        disease_name = encoder.inverse_transform([final_pred])[0]
        print(f"Predicted Disease: {disease_name}")

        # Find possible diseases with similar symptoms
        possible_diseases = [disease for disease, symptoms in disease_symptom_map.items() if any(sym in filtered_symptoms for sym in symptoms)]
        print(f"Possible Diseases: {possible_diseases}")  # Debug log

        # If only one disease is predicted, return it
        if len(possible_diseases) == 1:
            print("Returning single disease prediction")
            return jsonify({'disease': disease_name})

        # If multiple diseases match, ask for additional symptoms
        distinguishing_symptoms = set()
        for disease in possible_diseases:
            distinguishing_symptoms.update(disease_symptom_map[disease])

        # Remove already provided symptoms
        distinguishing_symptoms.difference_update(filtered_symptoms)
        print(f"Asking for more symptoms: {list(distinguishing_symptoms)[:3]}")

        print("Returning multiple diseases with additional symptoms")
        return jsonify({
            "possible_diseases": possible_diseases,
            "ask_more_symptoms": list(distinguishing_symptoms)[:3]  # Ask about 3 more symptoms
        })

    except Exception as e:
        print("❌ Error in /predict:", str(e))
        return jsonify({'error': str(e)}), 500

# @app.route('/api/predict', methods=['POST'])
# def predict():
#     try:
#         data = request.get_json()
#         if not data:
#             return jsonify({"error": "Invalid or missing JSON request body"}), 400

#         user_symptoms = data.get('symptoms', [])
#         additional_symptoms = data.get('additional_symptoms', [])
#         if not isinstance(user_symptoms, list) or not isinstance(additional_symptoms, list):
#             return jsonify({"error": "Symptoms must be provided as a list"}), 400

#         all_symptoms = list(set(user_symptoms + additional_symptoms))
#         filtered_symptoms = [symptom for symptom in all_symptoms if symptom in valid_symptoms]
#         if not filtered_symptoms:
#             return jsonify({"error": "No valid symptoms provided."}), 400

#         symptoms_dict = {symptom: 1 if symptom in filtered_symptoms else 0 for symptom in valid_symptoms}
#         symptoms_array = pd.DataFrame([symptoms_dict])

#         svm_pred = svm_model.predict(symptoms_array)
#         nb_pred = nb_model.predict(symptoms_array)
#         rf_pred = rf_model.predict(symptoms_array)

#         final_pred = stats.mode([svm_pred[0], nb_pred[0], rf_pred[0]], axis=None).mode
#         if isinstance(final_pred, np.ndarray):
#             final_pred = final_pred[0]

#         disease_name = encoder.inverse_transform([final_pred])[0]
#         possible_diseases = [disease for disease, symptoms in disease_symptom_map.items() 
#                             if all(sym in symptoms for sym in filtered_symptoms if sym in valid_symptoms)]
        
#         if not possible_diseases:
#             # Fallback to diseases matching at least one symptom if none match all
#             possible_diseases = [
#                 disease for disease, symptoms in disease_symptom_map.items()
#                 if any(sym in filtered_symptoms for sym in symptoms)
#             ]

#         if len(possible_diseases) == 1:
#             return jsonify({'disease': possible_diseases[0]})

#         distinguishing_symptoms = set()
#         for disease in possible_diseases:
#             distinguishing_symptoms.update(disease_symptom_map[disease])
#         distinguishing_symptoms.difference_update(filtered_symptoms)

#         if not distinguishing_symptoms:
#             return jsonify({
#                 "possible_diseases": possible_diseases,
#                 "ask_more_symptoms": []
#             })

#         # Select one distinguishing symptom
#         one_symptom = list(distinguishing_symptoms)[0]
#         return jsonify({
#             "possible_diseases": possible_diseases,
#             "ask_more_symptoms": [one_symptom]
#         })
#     except Exception as e:
#         print("❌ Error in /predict:", str(e))
#         return jsonify({'error': str(e)}), 500
    
if __name__ == '__main__':
    app.run(debug=True, port=5001)

