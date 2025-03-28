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
    const [additionalSymptom, setAdditionalSymptom] = useState(null); // Single symptom
    const [error, setError] = useState("");
    const [refinementCount, setRefinementCount] = useState(0);
    const [chatbotSuggested, setChatbotSuggested] = useState(false);
    const MAX_REFINEMENTS = 3;

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
        setRefinementCount(0);
        setChatbotSuggested(false);
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
        setRefinementCount(0);
        setChatbotSuggested(false);

        try {
            const initialSymptoms = selectedSymptoms.map(s => s.value);
            console.log("🟡 Initial Symptoms:", initialSymptoms);
            const response = await predictDisease(initialSymptoms);
            console.log("🟢 Initial Prediction Response:", response);
            if (response.disease) {
                setPrediction(response.disease);
            } else if (response.chatbot_suggested) {
                setError(response.message);
                setChatbotSuggested(true);
                if (response.predicted_disease) {
                    setPrediction(response.predicted_disease);
                }
            } else if (response.possible_diseases) {
                setPossibleDiseases(response.possible_diseases);
                setAdditionalSymptom(response.ask_more_symptoms[0] || null);
            }
        } catch (err) {
            setError("Error predicting disease. Please try again.");
            setChatbotSuggested(true);
        }
    };

    const handleRefinePrediction = async (confirmed) => {
        if (refinementCount >= MAX_REFINEMENTS) {
            const allSymptoms = [...selectedSymptoms.map(s => s.value), ...refinedSymptoms];
            const response = await predictDisease(allSymptoms);
            setPrediction(response.disease || "Unable to determine a single disease.");
            setPossibleDiseases([]);
            setAdditionalSymptom(null);
            setError("");
            setChatbotSuggested(false);
            return;
        }

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
                setChatbotSuggested(false);
            } else if (response.chatbot_suggested) {
                setError(response.message);
                setChatbotSuggested(true);
                if (response.predicted_disease) {
                    setPrediction(response.predicted_disease);
                }
                setPossibleDiseases([]);
                setAdditionalSymptom(null);
            } else if (response.possible_diseases) {
                setPossibleDiseases(response.possible_diseases);
                setAdditionalSymptom(response.ask_more_symptoms[0] || null);
                setRefinementCount(refinementCount + 1);
                if (!response.ask_more_symptoms.length || refinementCount + 1 >= MAX_REFINEMENTS) {
                    setPrediction(response.possible_diseases[0] || "Unable to determine a single disease.");
                    setPossibleDiseases([]);
                    setAdditionalSymptom(null);
                }
            } else {
                setError("Unexpected response from server.");
                setChatbotSuggested(true);
            }
        } catch (err) {
            setError("Error refining prediction. Please try again.");
            setChatbotSuggested(true);
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
                            placeholder="Type to search symptoms..."
                            value={selectedSymptoms}
                        />
                        <br/>
                        <h6><small>Note: If your symptom is not present in the list,Please use chatbot</small></h6>
                        <button onClick={handlePredict} style={{ marginTop: "10px", padding: "8px 15px" }}>
                            Predict
                        </button>
                        {error && <p style={{ color: "red" }}>{error}</p>}
                        {prediction && <p><strong>Predicted Disease:</strong> {prediction}</p>}
                        {possibleDiseases.length > 0 && refinementCount < MAX_REFINEMENTS && (
                            <div>
                                <h3>Possible Diseases:</h3>
                                <ul>
                                    {possibleDiseases.map((disease, index) => (
                                        <li key={index}>{disease}</li>
                                    ))}
                                </ul>
                                {refinedSymptoms.length > 0 && (
                                    <p><strong>Confirmed Symptoms:</strong> {refinedSymptoms.join(", ")}</p>
                                )}
                                {additionalSymptom && (
                                    <div>
                                        <h4>Do you have this symptom? ({refinementCount + 1}/{MAX_REFINEMENTS})</h4>
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
                                )}
                            </div>
                        )}
                        {chatbotSuggested && (
                            <p>
                                <strong>Suggestion:</strong> Please use the chatbot for further assistance.
                            </p>
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