// No imports needed - using React Router's Link component
import { useAuth } from '../auth/ZKAuthProvider';

export function HomePage() {
    const { logout, token } = useAuth();

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Welcome to ZK Rate My Prof</h1>
            <div className="bg-green-100 border border-green-500 text-green-700 p-4 rounded mb-4">
                Login Successful! Token: {token?.slice(0, 10)}...
            </div>
            <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded"
            >
                Logout
            </button>
        </div>
    );
}
