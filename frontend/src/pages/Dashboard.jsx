import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select"; // Import react-select
import { getSymptoms, predictDisease } from "../api/api"; // Ensure correct API import
import Navbar from "../components/Navbar";

const Dashboard = () => {
    const navigate = useNavigate();
    const [symptomOptions, setSymptomOptions] = useState([]);
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);
    const [user, setUser] = useState(null);
    const [prediction, setPrediction] = useState("");
    const [possibleDiseases, setPossibleDiseases] = useState([]);
    const [additionalSymptoms, setAdditionalSymptoms] = useState([]);
    const [error, setError] = useState("");

    // Fetch symptoms from Flask when the component loads
    useEffect(() => {
        const fetchSymptoms = async () => {
            try {
                const symptoms = await getSymptoms(); // Fetch symptoms dynamically
                console.log("Symptoms received:", symptoms); // Debugging
                setSymptomOptions(symptoms);
            } catch (err) {
                setError("Failed to load symptoms.");
            }
        };
        fetchSymptoms();
    }, []);

    // Fetch user details from localStorage
    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) {
            alert("Please log in first!");
            navigate("/login"); // Redirect if no user is found
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [navigate]);

    // Handle symptom selection
    const handleChange = (selectedOptions) => {
        setSelectedSymptoms(selectedOptions || []);
    };

    // Send symptoms to backend for prediction
    const handlePredict = async () => {
        if (selectedSymptoms.length === 0) {
            setError("Please select at least one symptom.");
            return;
        }
        setError("");
        setPrediction("");
        setPossibleDiseases([]);
        setAdditionalSymptoms([]);

        try {
            const response = await predictDisease(selectedSymptoms.map(s => s.value));
            if (response.possible_diseases) {
                setPossibleDiseases(response.possible_diseases);
                setAdditionalSymptoms(response.ask_more_symptoms);
            } else {
                setPrediction(response.disease);
            }
        } catch (err) {
            setError("Error predicting disease. Please try again.");
        }
    };

    const handleRefinePrediction = async (selectedAdditionalSymptoms) => {
        const refinedSymptoms = [...selectedSymptoms.map(s => s.value), ...selectedAdditionalSymptoms];
        setSelectedSymptoms([...selectedSymptoms, ...selectedAdditionalSymptoms.map(symptom => ({ value: symptom, label: symptom }))]);

        try {
            const response = await predictDisease(refinedSymptoms);
            setPrediction(response.disease);
            setPossibleDiseases([]);
            setAdditionalSymptoms([]);
        } catch (err) {
            setError("Error refining prediction. Please try again.");
        }
    };

    return (
        <div>
            {user ? (
                <>
                    <Navbar user={user} />
                    <h2>Welcome to the Dashboard, {user.name}!</h2>
                    <div style={{ textAlign: "center", padding: "20px" }}>
                        <h2>Health Prediction Dashboard</h2>
                        {/* Autocomplete dropdown */}
                        <Select
                            options={symptomOptions}
                            isMulti
                            onChange={handleChange}
                            placeholder="Type to search symptoms..."
                        />

                        <button onClick={handlePredict} style={{ marginTop: "10px", padding: "8px 15px" }}>
                            Predict
                        </button>

                        {error && <p style={{ color: "red" }}>{error}</p>}
                        {prediction && <p><strong>Predicted Disease:</strong> {prediction}</p>}
                        {possibleDiseases.length > 0 && (
                        <div>
                            <h3>Multiple diseases detected. Can you confirm if you have these symptoms?</h3>
                            <Select options={additionalSymptoms.map(s => ({ value: s, label: s }))} isMulti onChange={(selected) => handleRefinePrediction(selected.map(s => s.value))} placeholder="Select additional symptoms..." />
                        </div>
                    )}
                    </div>
                </>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default Dashboard;
