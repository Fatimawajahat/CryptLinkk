import { useState } from "react";
import axios from "axios";
import { generateAndStoreIdentityKeyIfMissing } from "../crypto/keyUtils";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const boxStyle = {
    width: "320px",
    margin: "40px auto",
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "10px",
    background: "#f9f9f9",
    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
  };

  const inputStyle = {
    width: "100%",
    padding: "10px",
    marginBottom: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
  };

  const buttonStyle = {
    width: "100%",
    padding: "10px",
    background: "black",
    color: "white",
    fontWeight: "bold",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "10px",
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setMessage("");

  try {
    const res = await axios.post("http://localhost:5000/api/auth/login", {
      username,
      password,
    });

    const { token, username: serverUsername, hasPublicKey } = res.data;

    localStorage.setItem("cryptlink_token", token);
    localStorage.setItem("cryptlink_username", serverUsername);

    // ✅ CRITICAL: Generate keys BEFORE calling onLogin
    setMessage("Generating encryption keys...");
    
    const publicKeyString = await generateAndStoreIdentityKeyIfMissing();

    // Only upload if server doesn't have it
    if (!hasPublicKey) {
      await axios.post(
        "http://localhost:5000/api/auth/save-public-key",
        { publicKey: publicKeyString },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }

    setMessage("Login successful");


    setTimeout(() => {
      if (onLogin) onLogin();
    }, 100);

  } catch (err) {
    console.error("login error", err);
    setMessage("Invalid username or password");
  }
};

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        padding: "40px 35px",
        border: "1px solid #e0e0e0",
        borderRadius: "16px",
        background: "#ffffff",
        boxShadow: "0 10px 40px rgba(0,0,0,0.15)"
      }}>
        
        {/* Logo/Title */}
        <div style={{ textAlign: "center", marginBottom: "35px" }}>
          <div style={{ fontSize: "48px", marginBottom: "10px" }}>🔐</div>
          <h2 style={{ 
            margin: "0 0 8px 0",
            fontSize: "28px",
            fontWeight: "700",
            color: "#25D366"
          }}>
            CryptLink
          </h2>
          <p style={{
            margin: "0",
            fontSize: "15px",
            color: "#666"
          }}>
            Welcome back! Please login
          </p>
        </div>

        {/* Username Input */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: "600",
            color: "#333"
          }}>
            Username
          </label>
          <input
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "10px",
              border: "1px solid #d9d9d9",
              fontSize: "15px",
              outline: "none",
              transition: "border 0.2s",
              boxSizing: "border-box"
            }}
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={(e) => e.target.style.border = "1px solid #25D366"}
            onBlur={(e) => e.target.style.border = "1px solid #d9d9d9"}
          />
        </div>

        {/* Password Input */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: "600",
            color: "#333"
          }}>
            Password
          </label>
          <input
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "10px",
              border: "1px solid #d9d9d9",
              fontSize: "15px",
              outline: "none",
              transition: "border 0.2s",
              boxSizing: "border-box"
            }}
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={(e) => e.target.style.border = "1px solid #25D366"}
            onBlur={(e) => e.target.style.border = "1px solid #d9d9d9"}
          />
        </div>

        {/* Login Button */}
        <button 
          onClick={handleSubmit}
          style={{
            width: "100%",
            padding: "14px",
            background: "#25D366",
            color: "white",
            fontWeight: "600",
            fontSize: "16px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)"
          }}
          onMouseOver={(e) => e.target.style.background = "#22c55e"}
          onMouseOut={(e) => e.target.style.background = "#25D366"}
        >
          Login
        </button>

        {/* Success/Error Message */}
        {message && (
          <div style={{ 
            textAlign: "center", 
            marginTop: "20px",
            padding: "12px",
            background: message.includes('successful') ? "#d4edda" : "#f8d7da",
            color: message.includes('successful') ? "#155724" : "#721c24",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "500"
          }}>
            {message}
          </div>
        )}

        {/* Register Link */}
        <p style={{
          textAlign: "center",
          marginTop: "24px",
          fontSize: "14px",
          color: "#666"
        }}>
          Don't have an account?{' '}
          <span style={{
            color: "#25D366",
            cursor: "pointer",
            fontWeight: "600"
          }}>
            Register here
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;
