import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { generateEmailVerifierInputs } from '../lib/email-parser';
import { enhancedZKProver } from '../lib/enhanced-zk-prover';

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
            console.log("[ZKAuthProvider] Prover status:", enhancedZKProver.getStatus());

            // 1. Generate Inputs for Circuit
            console.log("Generating inputs...");
            const inputs = await generateEmailVerifierInputs(rawEmail, {
                maxHeadersLength: 1024,
                maxBodyLength: 0,
                ignoreBodyHashCheck: true
            });

            console.log("Inputs generated:", inputs);

            // 2. Generate Proof using enhanced prover
            console.log("Generating proof with enhanced prover...");
            const result = await enhancedZKProver.generateProof(inputs);
            const { proof, publicSignals } = result;

            console.log("Proof generated!");

            // 3. Send to Server
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proof,
                    publicSignals
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Verification failed on server');
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
