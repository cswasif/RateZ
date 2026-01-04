import { useState } from 'react';
import { useAuth } from '../auth/ZKAuthProvider';

export function AuthPage() {
    const { login, isProving, error } = useAuth();
    const [rawEmail, setRawEmail] = useState('');

    const handleLogin = () => {
        if (!rawEmail) return;
        login(rawEmail);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-6">
                <h1 className="text-3xl font-bold mb-2">Student Login</h1>
                <p className="text-gray-400 mb-6">Verify your @g.bracu.ac.bd email anonymously using Zero-Knowledge Proofs.</p>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="bg-gray-700 p-4 rounded text-sm text-gray-300">
                        <h3 className="font-bold text-white mb-2">Instructions:</h3>
                        <ol className="list-decimal pl-4 space-y-1">
                            <li>Log in to your <b>g.bracu.ac.bd</b> Gmail.</li>
                            <li>Send an email to yourself with subject: <b>LOGIN</b></li>
                            <li>Open the email you received.</li>
                            <li>Click "Three Dots" ⋮ ({'>'}) "Show Original".</li>
                            <li>Click "Copy to clipboard" (or copy full text).</li>
                            <li>Paste it below.</li>
                        </ol>
                    </div>

                    <textarea
                        className="w-full h-40 bg-gray-900 border border-gray-700 rounded p-3 text-xs font-mono text-gray-300 focus:outline-none focus:border-blue-500"
                        placeholder="Delivered-To: your.name@g.bracu.ac.bd..."
                        value={rawEmail}
                        onChange={(e) => setRawEmail(e.target.value)}
                    />

                    <button
                        onClick={handleLogin}
                        disabled={isProving || !rawEmail}
                        className={`w-full py-3 rounded font-bold text-lg transition-colors ${isProving
                                ? 'bg-blue-800 cursor-wait'
                                : 'bg-blue-600 hover:bg-blue-500'
                            }`}
                    >
                        {isProving ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin text-xl">⚙️</span> Generating Proof...
                            </span>
                        ) : (
                            'Verify & Login'
                        )}
                    </button>

                    <p className="text-xs text-center text-gray-500 mt-2">
                        <b>Privacy Note:</b> Your email content is processed locally.
                        Only a mathematical proof is sent to the server.
                        Your identity is never revealed.
                    </p>
                </div>
            </div>
        </div>
    );
}
