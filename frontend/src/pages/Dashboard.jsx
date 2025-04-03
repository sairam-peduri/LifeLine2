import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import { getDiseaseDetails, getSymptoms, predictDisease } from "../api/api";
import Navbar from "../components/Navbar";
import "./Dashboard.css";

const Dashboard = () => {
    const navigate = useNavigate();
    const [symptomOptions, setSymptomOptions] = useState([]);
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);
    const [refinedSymptoms, setRefinedSymptoms] = useState([]);
    const [user, setUser] = useState(null);
    const [prediction, setPrediction] = useState("");
    const [details, setDetails] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [possibleDiseases, setPossibleDiseases] = useState([]);
    const [additionalSymptom, setAdditionalSymptom] = useState(null);
    const [error, setError] = useState("");
    const [refinementCount, setRefinementCount] = useState(0);
    const [chatbotSuggested, setChatbotSuggested] = useState(false);
    const MAX_REFINEMENTS = 3;

    useEffect(() => {
        const fetchSymptoms = async () => {
            try {
                console.log("Fetching symptoms...");
                const symptoms = await getSymptoms();
                console.log("Symptoms loaded:", symptoms);
                setSymptomOptions(symptoms);
            } catch (err) {
                console.error("Failed to fetch symptoms:", err);
                setError(`Failed to load symptoms: ${err.message}`);
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
        setDetails(null);
        setIsDetailsOpen(false);
        setPossibleDiseases([]);
        setAdditionalSymptom(null);
        setError("");
        setRefinementCount(0);
        setChatbotSuggested(false);
    };

    const fetchDetails = async (disease, symptoms) => {
        try {
            const detailsData = await getDiseaseDetails(disease, symptoms);
            setDetails(detailsData);
        } catch (err) {
            console.error("Failed to fetch details:", err);
            setDetails({
                description: "Error fetching details.",
                causes: ["- Unknown"],
                precautions: ["- Consult a doctor."],
                medicines: ["- Consult a doctor."]
            });
        }
    };

    const handlePredict = async () => {
        if (selectedSymptoms.length === 0) {
            setError("Please select at least one symptom.");
            return;
        }
        setError("");
        setPrediction("");
        setDetails(null);
        setIsDetailsOpen(false);
        setPossibleDiseases([]);
        setAdditionalSymptom(null);
        setRefinedSymptoms([]);
        setRefinementCount(0);
        setChatbotSuggested(false);

        try {
            const initialSymptoms = selectedSymptoms.map(s => s.value);
            console.log("🟡 Initial Symptoms:", initialSymptoms);
            const payload = {
                symptoms: initialSymptoms,
                additional_symptoms: [],
                refinement_count: 0
            };
            console.log("Sending initial payload:", JSON.stringify(payload, null, 2));
            const response = await predictDisease(payload);
            console.log("🟢 Prediction Response:", JSON.stringify(response, null, 2));
            if (response.disease) {
                setPrediction(response.disease);
                fetchDetails(response.disease, initialSymptoms);
            } else if (response.chatbot_suggested) {
                setError(response.message);
                setChatbotSuggested(true);
            } else if (response.possible_diseases && response.ask_more_symptoms) {
                setPossibleDiseases(response.possible_diseases);
                setAdditionalSymptom(response.ask_more_symptoms[0]);
                setRefinementCount(0); // Explicitly set to 0 for first prompt
            } else {
                setError("Unexpected initial response from server");
            }
        } catch (err) {
            setError("Error predicting disease: " + err.message);
            console.error("Prediction error:", err);
        }
    };

    const handleRefinePrediction = async (confirmed) => {
        const newRefinementCount = refinementCount + 1;
        console.log(`Refinement count: ${newRefinementCount}, Confirmed: ${confirmed}`);

        if (confirmed) {
            setRefinedSymptoms([...refinedSymptoms, additionalSymptom]);
        }

        const currentRefined = confirmed ? [...refinedSymptoms, additionalSymptom] : refinedSymptoms;
        const allSymptoms = [...selectedSymptoms.map(s => s.value), ...currentRefined];

        try {
            console.log("🟡 Combined Symptoms for Refinement:", allSymptoms);
            const payload = {
                symptoms: selectedSymptoms.map(s => s.value),
                additional_symptoms: currentRefined,
                refinement_count: newRefinementCount
            };
            console.log("Sending refinement payload:", JSON.stringify(payload, null, 2));
            const response = await predictDisease(payload);
            console.log("🟢 Refined Prediction Response:", JSON.stringify(response, null, 2));

            if (response.disease) {
                setPrediction(response.disease);
                fetchDetails(response.disease, allSymptoms);
                setPossibleDiseases([]);
                setAdditionalSymptom(null);
                setRefinementCount(0);
            } else if (response.chatbot_suggested) {
                setError(response.message);
                setChatbotSuggested(true);
                setPossibleDiseases([]);
                setAdditionalSymptom(null);
                setRefinementCount(0);
            } else if (response.possible_diseases && response.ask_more_symptoms && newRefinementCount < MAX_REFINEMENTS) {
                setPossibleDiseases(response.possible_diseases);
                setAdditionalSymptom(response.ask_more_symptoms[0]);
                setRefinementCount(newRefinementCount);
            } else if (newRefinementCount >= MAX_REFINEMENTS) {
                // Backend should have returned a disease; if not, log but proceed with last known prediction
                console.error("Expected a single disease from backend after 3 refinements:", response);
                setError(""); // No error displayed to user
                setPossibleDiseases([]);
                setAdditionalSymptom(null);
                setRefinementCount(0);
                // Rely on backend to provide disease; if it fails, it’s a backend issue
            } else {
                console.error("Unexpected response during refinement:", response);
                setError("Unexpected response from server");
                setRefinementCount(0);
            }
        } catch (err) {
            setError("Error refining prediction: " + err.message);
            console.error("Refinement error:", err);
            setRefinementCount(0);
        }
    };

    const toggleDetails = () => setIsDetailsOpen(!isDetailsOpen);

    return (
        <div>
            {user ? (
                <>
                    <Navbar user={user} />
                    <h2>Welcome to the Dashboard, {user.name}!</h2>
                    <div className="dashboard-container">
                        <h2>Health Prediction Dashboard</h2>
                        <Select
                            options={symptomOptions}
                            isMulti
                            onChange={handleChange}
                            placeholder="Type to search initial symptoms..."
                            value={selectedSymptoms}
                        />
                        <button onClick={handlePredict} className="predict-button">
                            Predict
                        </button>
                        {error && <p className="error">{error}</p>}
                        {prediction && (
                            <div className="prediction-container">
                                <div className="prediction-header" onClick={toggleDetails}>
                                    <strong>Predicted Disease:</strong> {prediction}
                                    <span className={`dropdown-arrow ${isDetailsOpen ? "open" : ""}`}>▼</span>
                                </div>
                                {details && isDetailsOpen ? (
                                    <div className="details-dropdown">
                                        <p><strong>Description:</strong> {details.description}</p>
                                        <p><strong>Causes:</strong></p>
                                        <ul>
                                            {details.causes.map((cause, index) => (
                                                <li key={index}>{cause}</li>
                                            ))}
                                        </ul>
                                        <p><strong>Precautions/Suggestions:</strong></p>
                                        <ul>
                                            {details.precautions.map((precaution, index) => (
                                                <li key={index}>{precaution}</li>
                                            ))}
                                        </ul>
                                        <p><strong>Medicines:</strong></p>
                                        <ul>
                                            {details.medicines.map((medicine, index) => (
                                                <li key={index}>{medicine}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : isDetailsOpen && (
                                    <div className="details-dropdown">
                                        <p>Loading details...</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {possibleDiseases.length > 0 && refinementCount < MAX_REFINEMENTS && additionalSymptom && (
                            <div className="refinement-container">
                                <h3>Possible Diseases:</h3>
                                <ul>
                                    {possibleDiseases.map((disease, index) => (
                                        <li key={index}>{disease}</li>
                                    ))}
                                </ul>
                                {refinedSymptoms.length > 0 && (
                                    <p><strong>Confirmed Symptoms:</strong> {refinedSymptoms.join(", ")}</p>
                                )}
                                <div className="symptom-prompt">
                                    <h4>Do you have this symptom? ({refinementCount + 1}/{MAX_REFINEMENTS})</h4>
                                    <p>{additionalSymptom}</p>
                                    <button onClick={() => handleRefinePrediction(true)} className="yes-button">
                                        Yes
                                    </button>
                                    <button onClick={() => handleRefinePrediction(false)} className="no-button">
                                        No
                                    </button>
                                </div>
                            </div>
                        )}
                        {chatbotSuggested && (
                            <p className="chatbot-suggestion">
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