import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { generateBRACUProof, loadCircuitFromUrl } from '../lib/zk-prover';

interface AuthContextType {
    isAuthenticated: boolean;
    isProving: boolean;
    token: string | null;
    login: (rawEmail: string) => Promise<void>;
    logout: () => void;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(localStorage.getItem('zk_session'));
    const [isProving, setIsProving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isAuthenticated = !!token;

    // Check valid session on load
    useEffect(() => {
        if (token) {
            fetch('/api/auth/session', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => {
                if (!res.ok) logout();
            });
        }
    }, [token]);

    const login = async (rawEmail: string) => {
        setIsProving(true);
        setError(null);
        try {
            console.log("Starting login process...");

            // 1. Load Circuit (if not loaded)
            try {
                // In production, this should be cached or loaded once
                await loadCircuitFromUrl('/circuits/bracu_verifier.json');
            } catch (e) {
                console.warn("Could not load circuit from URL, checking if already set...");
            }

            // 2. Generate Proof using Noir Prover
            console.log("Generating proof with Noir...");
            const result = await generateBRACUProof(rawEmail, {
                maxHeaderLength: 2560
            });

            console.log("Proof generated!", result);

            // 3. Send to Server
            // Backend expects: { proof: number[], publicInputs: string[] }
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proof: result.proof,
                    publicInputs: result.publicInputs
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(data.error || `Verification failed: ${res.status}`);
            }

            const { token } = await res.json();
            setToken(token);
            localStorage.setItem('zk_session', token);

        } catch (err: unknown) {
            console.error("Login failed:", err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message || "Failed to generate proof. check console.");
        } finally {
            setIsProving(false);
        }
    };

    const logout = () => {
        setToken(null);
        localStorage.removeItem('zk_session');
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, isProving, token, login, logout, error }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
