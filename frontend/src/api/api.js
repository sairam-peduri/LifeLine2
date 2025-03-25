import axios from "axios";

const API = axios.create({
    baseURL: "http://localhost:5000/api", // ✅ Base URL set correctly
});

export const getSymptoms = async () => {
    try {
        const response = await API.get("/get_symptoms"); // ✅ Matches Flask
        console.log("Fetched Symptoms:", response.data.symptoms);
        return response.data.symptoms.map(symptom => ({
            value: symptom,
            label: symptom.replace(/_/g, " ") // Format for display
        }));
    } catch (error) {
        console.error("❌ Error fetching symptoms:", error);
        throw error;
    }
};

export const predictDisease = async (symptoms) => {
    try {
        const response = await API.post("/predict", { symptoms });
        return response.data.disease;
    } catch (error) {
        console.error("❌ Error predicting disease:", error);
        throw error.response?.data?.error || "Error predicting disease";
    }
};

export default API;
