let API_BASE = "http://localhost:8000"; // Default
let API_KEY = "";

export function configureApi(url, key) {
    if (url) API_BASE = url;
    if (key) API_KEY = key;
}

function getHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
    return headers;
}


/**
 * Start or reset the game
 * @param {string} settings - Initialization settings for AI
 * returns { state: GameState, options: GameOption[] }
 */
export async function initGame(settings = "") {
    try {
        const response = await fetch(`${API_BASE}/api/init`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ settings })
        });
        if (!response.ok) throw new Error("Failed to init game");
        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

/**
 * Send player action to backend
 * @param {Object} action - 玩家行动对象，包含 label, customText, effects 等
 * @param {Array<string>} systemPrompts - 需要注入到 AI Context 中的系统提示（来自事件系统）
 * returns { state: GameState, options: GameOption[] }
 */
export async function sendAction(action, systemPrompts = []) {
    try {
        const response = await fetch(`${API_BASE}/api/action`, {
            method: "POST",
            headers: getHeaders(),
            // Backend expects PlayerAction fields directly in body
            body: JSON.stringify(action)
        });
        if (!response.ok) throw new Error("Failed to send action");
        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}


/**
 * Send player action to backend and Stream response (V4.0)
 * Uses Server-Sent Events (SSE) format over a POST stream.
 * @param {Object} action - Player Action
 * @param {Function} onChunk - Callback for each JSON chunk received
 * @returns {Promise<void>}
 */
export async function sendActionStream(action, onChunk) {
    try {
        const response = await fetch(`${API_BASE}/api/action`, {
            method: "POST",
            headers: {
                ...getHeaders(),
                "Accept": "text/event-stream"
            },
            body: JSON.stringify(action)
        });

        if (!response.ok) throw new Error("Failed to connect to Nexus-Stream");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process SSE "data: {...}\n\n"
            const lines = buffer.split("\n\n");
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const jsonStr = line.slice(6);
                    try {
                        const data = JSON.parse(jsonStr);
                        onChunk(data);
                    } catch (e) {
                        console.warn("Stream JSON parse error:", e);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Stream API Error:", error);
        throw error;
    }
}
