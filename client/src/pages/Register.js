import { useState } from "react";
import axios from "axios";

function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    // Simulated registration
    if (username && password) {
      setMessage('Registration successful! 🎉');
    } else {
      setMessage('Please fill in all fields');
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
            Create your secure account
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
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={(e) => e.target.style.border = "1px solid #25D366"}
            onBlur={(e) => e.target.style.border = "1px solid #d9d9d9"}
          />
        </div>

        {/* Register Button */}
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
          Create Account
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

        {/* Login Link */}
        <p style={{
          textAlign: "center",
          marginTop: "24px",
          fontSize: "14px",
          color: "#666"
        }}>
          Already have an account?{' '}
          <span style={{
            color: "#25D366",
            cursor: "pointer",
            fontWeight: "600"
          }}>
            Login here
          </span>
        </p>
      </div>
    </div>
  );
}

export default Register;
