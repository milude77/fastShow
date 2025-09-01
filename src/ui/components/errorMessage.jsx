import React, { useEffect, useState } from "react";


const ErrorMessage = ({ error }) => {

    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const handleErrorMessage = (message) => {
            setErrorMsg(message);
        }

        window.electronAPI.receiveErrorMessage(handleErrorMessage);


        return () => {
            window.electronAPI.removeErrorListeners();
        }
    }, [error]);

    return (
        <h4 className="error-message">{errorMsg}</h4>
    );
};

export default ErrorMessage;