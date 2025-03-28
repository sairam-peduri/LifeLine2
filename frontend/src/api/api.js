import axios from "axios";

const API = axios.create({
    baseURL: "http://localhost:5000/api", // ✅ Base URL set correctly
});

export const login = async (credentials) => {
    try {
        const response = await API.post("/auth/login", credentials);
        return response.data;
    } catch (error) {
        console.error("❌ Error during login:", error);
        throw error.response?.data?.error || "Login failed";
    }
};

export const signup = async (userData) => {
    try {
        const response = await API.post("/auth/signup", userData);
        return response.data;
    } catch (error) {
        console.error("❌ Error during signup:", error);
        throw error.response?.data?.error || "Signup failed";
    }
};

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

// ✅ First API call to predict disease
export const predictDisease = async (selectedSymptoms) => {
    try {
        console.log("sending symptoms:", selectedSymptoms);
        const response = await API.post("/predict", 
            { symptoms: selectedSymptoms },
            { headers: { 'Content-Type': 'application/json' } }
        );
        console.log("Prediction Response (Raw):", JSON.stringify(response.data, null, 2)); // Log full response
        if (!response.data) {
            throw new Error("No response data from server");
        }
        // Accept any response with either 'disease' or 'possible_diseases'
        if (!response.data.disease && !response.data.possible_diseases) {
            throw new Error("Response missing required fields");
        }
        return response.data;
    } catch (error) {
        console.error("❌ Error predicting disease:", error);
        console.error("❌ Server Response:", error.response?.data); 
        throw error.response?.data?.error || "Error predicting disease";
    }
};

// ✅ Second API call to refine prediction with extra symptoms
export const refinePrediction = async (selectedSymptoms, extraSymptoms) => {
    try {
        const response = await API.post("/predict", {
                symptoms: selectedSymptoms,  // Send original symptoms 
                additional_symptoms: extraSymptoms  // Send new symptoms
        });
        console.log("Refined Prediction Response:", response.data);

        return response.data; // ✅ Return response instead of setting state
    } catch (error) {
        console.error("Error refining prediction:", error);
        throw error.response?.data?.error || "Error refining prediction";
    }
};


export default API;
