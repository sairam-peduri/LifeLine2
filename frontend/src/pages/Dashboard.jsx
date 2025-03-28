import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import { getSymptoms, predictDisease } from "../api/api";
import Navbar from "../components/Navbar";

const Dashboard = () => {
    const navigate = useNavigate();
    const [symptomOptions, setSymptomOptions] = useState([]);
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);
    const [refinedSymptoms, setRefinedSymptoms] = useState([]);
    const [user, setUser] = useState(null);
    const [prediction, setPrediction] = useState("");
    const [possibleDiseases, setPossibleDiseases] = useState([]);
    const [additionalSymptom, setAdditionalSymptom] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchSymptoms = async () => {
            try {
                const symptoms = await getSymptoms();
                console.log("Symptoms received:", symptoms);
                setSymptomOptions(symptoms);
            } catch (err) {
                setError("Failed to load symptoms.");
            }
        };
        fetchSymptoms();
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) {
            alert("Please log in first!");
            navigate("/login");
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [navigate]);

    const handleChange = (selectedOptions) => {
        setSelectedSymptoms(selectedOptions || []);
        setRefinedSymptoms([]);
        setPrediction("");
        setPossibleDiseases([]);
        setAdditionalSymptom(null);
        setError("");
    };

    const handlePredict = async () => {
        if (selectedSymptoms.length === 0) {
            setError("Please select at least one symptom.");
            return;
        }
        setError("");
        setPrediction("");
        setPossibleDiseases([]);
        setAdditionalSymptom(null);
        setRefinedSymptoms([]);

        try {
            const initialSymptoms = selectedSymptoms.map(s => s.value);
            console.log("🟡 Initial Symptoms:", initialSymptoms);
            const response = await predictDisease(initialSymptoms);
            console.log("🟢 Initial Prediction Response:", response);
            if (response.disease) {
                setPrediction(response.disease);
            } else if (response.possible_diseases) {
                setPossibleDiseases(response.possible_diseases);
                setAdditionalSymptom(response.ask_more_symptoms[0] || null);
            }
        } catch (err) {
            setError("Error predicting disease. Please try again.");
        }
    };

    const handleRefinePrediction = async (confirmed) => {
        const allSymptoms = [...selectedSymptoms.map(s => s.value), ...refinedSymptoms];
        if (confirmed) {
            setRefinedSymptoms([...refinedSymptoms, additionalSymptom]);
            allSymptoms.push(additionalSymptom);
        }

        try {
            console.log("🟡 Combined Symptoms for Refinement:", allSymptoms);
            const response = await predictDisease(allSymptoms);
            console.log("🟢 Refined Prediction Response:", response);

            if (response.disease) {
                setPrediction(response.disease);
                setPossibleDiseases([]);
                setAdditionalSymptom(null);
                setError("");
            } else if (response.possible_diseases) {
                setPossibleDiseases(response.possible_diseases);
                setAdditionalSymptom(response.ask_more_symptoms[0] || null);
                if (!response.ask_more_symptoms.length) {
                    setError("No more symptoms to refine. Multiple diseases remain.");
                } else {
                    setError("");
                }
            } else {
                setError("Unexpected response from server.");
            }
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
                        <Select
                            options={symptomOptions}
                            isMulti
                            onChange={handleChange}
                            placeholder="Type to search initial symptoms..."
                            value={selectedSymptoms}
                        />
                        <button onClick={handlePredict} style={{ marginTop: "10px", padding: "8px 15px" }}>
                            Predict
                        </button>
                        {error && <p style={{ color: "red" }}>{error}</p>}
                        {prediction && <p><strong>Predicted Disease:</strong> {prediction}</p>}
                        {possibleDiseases.length > 0 && (
                            <div>
                                <h3>Possible Diseases:</h3>
                                <ul>
                                    {possibleDiseases.map((disease, index) => ( // Fixed typo here
                                        <li key={index}>{disease}</li>
                                    ))}
                                </ul>
                                {refinedSymptoms.length > 0 && (
                                    <p><strong>Confirmed Symptoms:</strong> {refinedSymptoms.join(", ")}</p>
                                )}
                                {additionalSymptom ? (
                                    <div>
                                        <h4>Do you have this symptom?</h4>
                                        <p>{additionalSymptom}</p>
                                        <button
                                            onClick={() => handleRefinePrediction(true)}
                                            style={{ margin: "5px", padding: "5px 10px" }}
                                        >
                                            Yes
                                        </button>
                                        <button
                                            onClick={() => handleRefinePrediction(false)}
                                            style={{ margin: "5px", padding: "5px 10px" }}
                                        >
                                            No
                                        </button>
                                    </div>
                                ) : (
                                    <p>No further symptoms to refine.</p>
                                )}
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