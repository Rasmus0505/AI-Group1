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
        const payload = {
            action,
            systemPrompts: systemPrompts.length > 0 ? systemPrompts : undefined
        };

        const response = await fetch(`${API_BASE}/api/action`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Failed to send action");
        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

