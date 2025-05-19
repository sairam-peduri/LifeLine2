import axios from "axios";

const PREDICTION_BASE_URL = "https://lifeline2-1.onrender.com/api"; 
const AUTH_BASE_URL = "https://lifeline2-hnpm.onrender.com/";

const PredictionAPI = axios.create({ baseURL: PREDICTION_BASE_URL }); 
const AuthAPI = axios.create({ baseURL: AUTH_BASE_URL });

export const login = async (credentials) => {
    try {
        const response = await AuthAPI.post("/auth/login", credentials);
        return response.data;
    } catch (error) {
        console.error("❌ Error during login:", error);
        throw error.response?.data?.error || "Login failed";
    }
};

export const signup = async (userData) => {
    try {
        const response = await AuthAPI.post("/auth/signup", userData);
        return response.data;
    } catch (error) {
        console.error("❌ Error during signup:", error);
        throw error.response?.data?.error || "Signup failed";
    }
};

export const getSymptoms = async () => {
    try {
        console.log("Fetching symptoms from:", `${PREDICTION_BASE_URL}/get_symptoms`);
        const response = await PredictionAPI.get("/get_symptoms");
        console.log("Symptoms response:", response.data);
        return response.data.symptoms.map(symptom => ({ value: symptom, label: symptom }));
    } catch (err) {
        console.error("Error in getSymptoms:", err);
        throw err.response?.data?.error || "Failed to fetch symptoms";
    }
};

export const predictDisease = async ({ symptoms, additional_symptoms = [], refinement_count = 0, username }) => {
    try {
        const payload = { symptoms, additional_symptoms, refinement_count, username };
        console.log("Sending payload to predict:", JSON.stringify(payload, null, 2));
        console.log("Fetching prediction from:", `${PREDICTION_BASE_URL}/predict`);
        const startTime = performance.now();
        const response = await PredictionAPI.post("/predict", payload);
        console.log(`Prediction took ${(performance.now() - startTime) / 1000} seconds`);
        console.log("Prediction response:", JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (err) {
        console.error("Error in predictDisease:", err);
        throw err.response?.data?.error || "Prediction failed";
    }
};

export const getDiseaseDetails = async (disease, symptoms) => {
    try {
        console.log("Fetching details for:", disease);
        const response = await PredictionAPI.post("/details", { disease, symptoms });
        console.log("Details response:", JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (err) {
        console.error("Error in getDiseaseDetails:", err);
        throw err.response?.data?.error || "Failed to fetch details";
    }
};

export const getPredictionHistory = async (username) => {
    try {
        console.log("Fetching history for:", username);
        const response = await PredictionAPI.get("/history", { params: { username } });
        console.log("History response:", JSON.stringify(response.data, null, 2));
        return response.data.history;
    } catch (err) {
        console.error("Error in getPredictionHistory:", err);
        throw err.response?.data?.error || "Failed to fetch history";
    }
};

export const chatWithBot = async (data) => {
    const response = await PredictionAPI.post("/chat", data);
    return response.data;
};
