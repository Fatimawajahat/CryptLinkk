import { useState, useEffect } from "react";
import Register from "./pages/Register";
import Login from "./pages/Login";
import CryptoPanel from "./pages/CryptoPanel";
import ChatPage from "./pages/ChatPage";

function App() {
  // login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // sessionKey produced after Step 5 (HELLO→RESPONSE→CONFIRM)
  const [sessionKey, setSessionKey] = useState(null);

  // peer user jisko msg bhejne hen
  const [peer, setPeer] = useState("");

  // logout on every reload as requested
  useEffect(() => {
    localStorage.removeItem("cryptlink_token");
    localStorage.removeItem("cryptlink_username");
  }, []);

  const container = {
    width: "100%",
    margin: "0 auto",
    paddingTop: "20px",
  };

  return (
    <div style={container}>

      {!isLoggedIn ? (
        <>
          <Register />
          <hr />
          <Login onLogin={() => setIsLoggedIn(true)} />
        </>
      ) : sessionKey ? (
        // once key exchange is done → open encrypted chat
        <ChatPage sessionKey={sessionKey} peer={peer} />
      ) : (
        // still no session key → show cryptopanel
        <CryptoPanel
          onSessionKeyReady={(key, partner) => {
            setSessionKey(key);
            setPeer(partner);
          }}
        />
      )}
    </div>
  );
}

export default App;