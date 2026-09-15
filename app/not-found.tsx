import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff8e7",
        color: "#111111",
        fontFamily: "inherit",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "460px",
          width: "100%",
          background: "#ffffff",
          border: "3px solid #111111",
          boxShadow: "8px 8px 0 #111111",
          padding: "32px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            background: "#feca57",
            border: "3px solid #111111",
            fontSize: "24px",
            fontWeight: 800,
            marginBottom: "16px",
          }}
          aria-hidden="true"
        >
          404
        </div>
        <h1 style={{ fontSize: "20px", margin: "0 0 8px", fontWeight: 800 }}>
          这个页面不存在
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: "14px", lineHeight: 1.7, color: "#444444" }}>
          你访问的地址没有对应的页面或接口。AgentShelf 的全部功能都在控制台首页，
          评委核验接口清单见随附的《部署核验清单》。
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "#ff6b6b",
            color: "#111111",
            border: "3px solid #111111",
            boxShadow: "4px 4px 0 #111111",
            padding: "10px 20px",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          返回控制台首页
        </Link>
      </div>
    </div>
  );
}
