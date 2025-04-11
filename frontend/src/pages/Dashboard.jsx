import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import { chatWithBot, getDiseaseDetails, getPredictionHistory, getSymptoms, predictDisease } from "../api/api";
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
    const [predictionHistory, setPredictionHistory] = useState([]);
    const [chatOpen, setChatOpen] = useState(false); // Chatbot toggle
    const [chatMessages, setChatMessages] = useState([]); // Chat history
    const [chatInput, setChatInput] = useState(""); // User input
    const [isChatLoading, setIsChatLoading] = useState(false);
    const MAX_REFINEMENTS = 3;
    const MAX_HISTORY = 10;

    useEffect(() => {
        const fetchSymptomsAndHistory = async () => {
            try {
                console.log("Fetching symptoms...");
                const symptoms = await getSymptoms();
                console.log("Symptoms loaded:", symptoms);
                setSymptomOptions(symptoms);

                const storedUser = localStorage.getItem("user");
                if (storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    const history = await getPredictionHistory(parsedUser.name);
                    setPredictionHistory(history.reverse()); // Newest first
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
                setError(`Failed to load data: ${err.message}`);
            }
        };
        fetchSymptomsAndHistory();
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) {
            alert("Please log in first!");
            navigate("/login");
        }else{
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
                refinement_count: 0,
                username: user.name
            };
            console.log("Sending initial payload:", JSON.stringify(payload, null, 2));
            const response = await predictDisease(payload);
            console.log("🟢 Prediction Response:", JSON.stringify(response, null, 2));
            if (response.disease) {
                setPrediction(response.disease);
                fetchDetails(response.disease, initialSymptoms);
                const history = await getPredictionHistory(user.name);
                setPredictionHistory(history.reverse());
            } else if (response.chatbot_suggested) {
                setError(response.message);
                setChatbotSuggested(true);
            } else if (response.possible_diseases && response.ask_more_symptoms) {
                setPossibleDiseases(response.possible_diseases);
                setAdditionalSymptom(response.ask_more_symptoms[0]);
                setRefinementCount(0);
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
                refinement_count: newRefinementCount,
                username: user.name
            };
            console.log("Sending refinement payload:", JSON.stringify(payload, null, 2));
            const response = await predictDisease(payload);
            console.log("🟢 Refined Prediction Response:", JSON.stringify(response, null, 2));

            if (response.disease) {
                setPrediction(response.disease);
                fetchDetails(response.disease, allSymptoms);
                const history = await getPredictionHistory(user.name);
                setPredictionHistory(history.reverse());
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
                console.error("Expected a single disease from backend after 3 refinements:", response);
                setError(""); // No error displayed to user
                setPossibleDiseases([]);
                setAdditionalSymptom(null);
                setRefinementCount(0);
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

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        const userMessage = { text: chatInput, sender: "user" };
        setChatMessages([...chatMessages, userMessage]);
        setIsChatLoading(true); // Start loading
        try {
            const response = await chatWithBot({ message: chatInput });
            const botMessage = { text: response.response, sender: "bot" };
            setChatMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            setChatMessages((prev) => [...prev, { text: "Sorry, I couldn’t respond!", sender: "bot" }]);
        }finally {
            setIsChatLoading(false); // Stop loading
            setChatInput("");
        }
    };

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
                        <br/>
                        <div className="details-section">
                                            <small><strong><p style={{color:"red"}}>Note: </p></strong></small><p><small>If symptoms are not present in list,use Chatbot.Its just a prediction.Please visit doctor if you have any emergency.</small></p>
                        </div>
                        {error && <p className="error">{error}</p>}
                        {prediction && (
                            <div className="prediction-container">
                                <div className="prediction-header" onClick={toggleDetails}>
                                    <strong>Predicted Disease:</strong> {prediction}
                                    <span className={`dropdown-arrow ${isDetailsOpen ? "open" : ""}`}>▼</span>
                                </div>
                                {details && isDetailsOpen ? (
                                    <div className="details-dropdown">
                                        <p className="description"><strong>About {prediction}:</strong> {details.description}</p>
                                        <div className="details-section">
                                            <h4><strong>Causes</strong></h4>
                                            <ul>
                                                {details.causes.map((cause, index) => (
                                                    <li key={index}>{cause}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="details-section">
                                            <h4><strong>Precautions/Suggestions</strong></h4>
                                            <ul>
                                                {details.precautions.map((precaution, index) => (
                                                    <li key={index}>{precaution}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="details-section">
                                            <h4><strong>Medicines</strong></h4>
                                            <ul>
                                                {details.medicines.map((medicine, index) => (
                                                    <li key={index}>{medicine}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="details-section">
                                            <strong>Note: </strong><p><small>Its just a prediction.If you are not sure about the disease and symptoms. Please visit doctor.</small></p>
                                        </div>
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
                                    {possibleDiseases.slice(0, 6).map((disease, index) => (
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
                        {/* Chatbot Widget */}
                        <div className="chatbot-container">
                            <button className="chatbot-toggle" onClick={() => setChatOpen(!chatOpen)}>
                                {chatOpen ? "Close Chat" : "Chat with Us"}
                            </button>
                            {chatOpen && (
                                <div className="chatbot-window">
                                    <div className="chat-messages">
                                        {chatMessages.length === 0 && (
                                            <p>Hi! I’m here to help. Not sure about symptoms? Ask me anything!</p>
                                        )}
                                        {chatMessages.map((msg, index) => (
                                            <div key={index} className={`chat-message ${msg.sender}`}>
                                                <span>{msg.text}</span>
                                            </div>
                                        ))}
                                        {isChatLoading && (
                                            <div className="chat-message bot">
                                                <span className="typing-animation">Typing<span>.</span><span>.</span><span>.</span></span>
                                            </div>
                                        )}
                                    </div>
                                    <form onSubmit={handleChatSubmit} className="chat-input-form">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="Type your message..."
                                            disabled={isChatLoading}
                                        />
                                        <button type="submit" disabled={isChatLoading}>Send</button>
                                    </form>
                                </div>
                            )}
                        </div>
                        {/* {predictionHistory.length > 0 && (
                            <div className="history-container">
                                <h3>Prediction History (Last {MAX_HISTORY})</h3>
                                <ul>
                                    {predictionHistory.map((entry, index) => (
                                        <li key={index}>
                                            <strong>{entry.disease}</strong> - Symptoms: {entry.symptoms.join(", ")} (Predicted on: {new Date(entry.timestamp).toLocaleString()})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )} */}
                    </div>
                </>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default Dashboard;