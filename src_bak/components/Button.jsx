export default function Button({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 16px",
        borderRadius: 20,
        border: "none",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 14,
        background: "#f1f1f1",
        boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        color: "black",
      }}
    >
      {children}
    </button>
  );
}