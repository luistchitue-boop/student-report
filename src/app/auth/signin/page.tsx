"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.error === "CredentialsSignin"
            ? "Email ou senha inválidos."
            : `Não foi possível iniciar sessão: ${result.error}`
        );
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>NEPH Relatórios</h1>
          <p>Entre na sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              placeholder="A sua palavra-passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="send-button" disabled={loading}>
            {loading ? "A entrar..." : "Entrar"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Precisa de uma conta? Contacte o administrador da escola.
          </p>
        </div>
      </div>

      <style>{`
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1rem;
        }

        .auth-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
          width: 100%;
          max-width: 420px;
          padding: 1.25rem;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .auth-header h1 {
          font-size: clamp(1.5rem, 4vw, 2rem);
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 0.5rem 0;
        }

        .auth-header p {
          color: #666;
          margin: 0;
          font-size: 0.95rem;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-size: 0.9rem;
          font-weight: 600;
          color: #333;
        }

        .form-group input {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        .error-message {
          padding: 0.75rem;
          background-color: #fee;
          color: #c33;
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .send-button {
          padding: 0.75rem;
          background-color: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .send-button:hover:not(:disabled) {
          background-color: #5568d3;
        }

        .send-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-footer {
          text-align: center;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid #eee;
        }

        .auth-footer p {
          margin: 0;
          font-size: 0.9rem;
          color: #666;
        }
      `}</style>
    </div>
  );
}
