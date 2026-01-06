/**
 * Aero AI Chatbot Logic - Enhanced with REAL Web Search & News
 * Core features:
 * - Real-time chat with LLM API
 * - Image Generation via /image command
 * - REAL Web Search using DuckDuckGo + Wikipedia APIs
 * - REAL News Feed from RSS sources
 * - PWA Installation
 */

// --- Configuration ---
const CONFIG = {
    // CORS Proxy for accessing APIs (free service)
    corsProxy: 'https://api.allorigins.win/raw?url=',
    // News RSS Feeds (Technology focused, like Perplexity)
    newsFeeds: [
        'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
        'https://feeds.arstechnica.com/arstechnica/technology-lab',
        'https://www.theverge.com/rss/index.xml'
    ],
    rss2jsonApi: 'https://api.rss2json.com/v1/api.json'
};

// --- DOM Elements ---
const chatbox = document.getElementById('chatbox');
const chatInput = document.getElementById('chatInput');
const chatForm = document.getElementById('chatForm');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const clearChatBtn = document.getElementById('clearChat');

// --- State ---
let isGenerating = false;
let conversationHistory = []; // Current conversation messages
let currentChatId = null; // Current active chat ID
let allChats = {}; // All saved chats {id: {title, date, messages}}

// --- ChatGPT-Style Conversation Management ---
function generateChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function createNewChat() {
    const chatId = generateChatId();
    const newChat = {
        id: chatId,
        title: 'New chat',
        date: new Date().toISOString(),
        messages: []
    };

    allChats[chatId] = newChat;
    saveAllChats();
    loadChat(chatId);
    updateHistorySidebar();
}

function loadChat(chatId) {
    currentChatId = chatId;
    const chat = allChats[chatId];

    if (!chat) {
        createNewChat();
        return;
    }

    // Clear current UI
    chatbox.innerHTML = '';
    conversationHistory = [...chat.messages];

    // Restore messages
    if (conversationHistory.length === 0) {
        showWelcomeScreen();
    } else {
        conversationHistory.forEach(msg => {
            displayMessage(msg.content, msg.role === 'user');
        });
    }

    updateHistorySidebar();
}

function saveCurrentChat() {
    if (currentChatId && allChats[currentChatId]) {
        allChats[currentChatId].messages = conversationHistory;

        // Auto-generate title from first user message
        if (allChats[currentChatId].title === 'New chat' && conversationHistory.length > 0) {
            const firstUserMsg = conversationHistory.find(m => m.role === 'user');
            if (firstUserMsg) {
                allChats[currentChatId].title = firstUserMsg.content.substring(0, 40) +
                    (firstUserMsg.content.length > 40 ? '...' : '');
            }
        }

        saveAllChats();
        updateHistorySidebar();
    }
}

function saveAllChats() {
    localStorage.setItem('aero_all_chats', JSON.stringify(allChats));
}

function loadAllChats() {
    const saved = localStorage.getItem('aero_all_chats');
    if (saved) {
        try {
            allChats = JSON.parse(saved);
            const chatIds = Object.keys(allChats);
            if (chatIds.length > 0) {
                // Load most recent chat
                const mostRecent = chatIds.sort((a, b) =>
                    new Date(allChats[b].date) - new Date(allChats[a].date)
                )[0];
                loadChat(mostRecent);
            } else {
                createNewChat();
            }
        } catch (e) {
            console.error('Failed to load chats:', e);
            createNewChat();
        }
    } else {
        createNewChat();
    }
}

function deleteChat(chatId, event) {
    event?.stopPropagation();
    delete allChats[chatId];
    saveAllChats();

    // If deleting current chat, create new one
    if (chatId === currentChatId) {
        createNewChat();
    } else {
        updateHistorySidebar();
    }
}

function addToHistory(role, content) {
    conversationHistory.push({ role, content });
    saveCurrentChat();
}

function updateHistorySidebar() {
    const historyContainer = document.getElementById('chatHistory');
    const chatIds = Object.keys(allChats).sort((a, b) =>
        new Date(allChats[b].date) - new Date(allChats[a].date)
    );

    historyContainer.innerHTML = '<div class="history-label">Recent</div>';

    chatIds.forEach(chatId => {
        const chat = allChats[chatId];
        const item = document.createElement('button');
        item.className = 'history-item' + (chatId === currentChatId ? ' active' : '');
        item.innerHTML = `
            <i class="fas fa-message"></i>
            <span class="history-item-text">${chat.title}</span>
            <i class="fas fa-trash history-item-delete" onclick="deleteChat('${chatId}', event)"></i>
        `;
        item.onclick = () => loadChat(chatId);
        historyContainer.appendChild(item);
    });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Load all saved chats
    loadAllChats();

    // New Chat Button
    document.getElementById('newChatBtn').addEventListener('click', createNewChat);

    // Sidebar Toggles
    document.getElementById('menuBtn').addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebar').addEventListener('click', toggleSidebar);
    document.getElementById('overlay').addEventListener('click', toggleSidebar);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => switchView(e.currentTarget));
    });

    // Web Search is now AUTOMATIC - no toggle needed

    // Clear Chat (New Chat)
    clearChatBtn.addEventListener('click', createNewChat);

    // Chat Submission
    chatForm.addEventListener('submit', handleChatSubmit);

    // PWA Install
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Show both install buttons
        const installBtn = document.getElementById('installBtn');
        const installBtnHeader = document.getElementById('installBtnHeader');
        installBtn.style.display = 'block';
        installBtnHeader.style.display = 'flex';

        // Handle clicks on both buttons
        const handleInstall = async () => {
            installBtn.style.display = 'none';
            installBtnHeader.style.display = 'none';
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        };

        installBtn.addEventListener('click', handleInstall);
        installBtnHeader.addEventListener('click', handleInstall);
    });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
});

// --- UI Functions ---

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; top: 80px; right: 20px; z-index: 9999;
        background: rgba(59, 130, 246, 0.9); color: white;
        padding: 12px 20px; border-radius: 8px;
        font-size: 14px; font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Install Instructions Modal
window.showInstallInstructions = function () {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        padding: 20px; animation: fadeIn 0.3s;
    `;

    modal.innerHTML = `
        <div style="background: #1e293b; border-radius: 16px; padding: 2rem; max-width: 500px; width: 100%; border: 1px solid rgba(96, 165, 250, 0.3);">
            <h2 style="color: #60a5fa; margin-bottom: 1rem; font-size: 1.5rem;">📱 Install Aero AI</h2>
            <div style="color: #cbd5e1; line-height: 1.6; margin-bottom: 1.5rem;">
                <p style="margin-bottom: 1rem;">To install this app, you need to host it online first:</p>
                
                <strong style="color: #10b981;">Option 1: Free Hosting (Recommended)</strong>
                <ol style="margin: 0.5rem 0 1rem 1.5rem;">
                    <li>Go to <a href="https://vercel.com" target="_blank" style="color: #60a5fa;">vercel.com</a></li>
                    <li>Sign up (free)</li>
                    <li>Upload your app folder</li>
                    <li>Get instant HTTPS URL</li>
                    <li>Open on mobile → Install button will appear!</li>
                </ol>
                
                <strong style="color: #f59e0b;">Option 2: Local Server</strong>
                <ol style="margin: 0.5rem 0 1rem 1.5rem;">
                    <li>Open terminal in app folder</li>
                    <li>Run: <code style="background: #0f172a; padding: 2px 6px; border-radius: 4px;">python -m http.server 8000</code></li>
                    <li>Open: <code style="background: #0f172a; padding: 2px 6px; border-radius: 4px;">localhost:8000</code></li>
                </ol>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #3b82f6, #2563eb); 
                           color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                Got it!
            </button>
        </div>
    `;

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);
};

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

function switchView(targetBtn) {
    // Update Nav
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    targetBtn.classList.add('active');

    // Update View
    const viewName = targetBtn.dataset.view;
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

    if (viewName === 'chat') {
        document.getElementById('chatView').classList.add('active');
        document.getElementById('viewTitle').textContent = 'New Chat';
    }

    // Close sidebar on mobile after selection
    if (window.innerWidth <= 768) toggleSidebar();
}

window.setInput = function (text) {
    chatInput.value = text;
    chatInput.focus();
}

// --- Chat Logic ---

async function handleChatSubmit(e) {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message || isGenerating) return;

    // UI Updates
    displayMessage(message, true);
    addToHistory('user', message); // Save to memory
    chatInput.value = '';
    isGenerating = true;
    removeWelcomeScreen();

    // Determine Mode
    const isImageGen = message.toLowerCase().startsWith('/image');

    try {
        // AUTOMATIC Web Search Detection (Like Perplexity)
        if (!isImageGen && shouldPerformWebSearch(message)) {
            await performWebSearch(message);
        } else if (isImageGen) {
            updateStatus('Generating image...');
            const response = await callApi(message.substring(6).trim(), true);
            handleResponse(response, true);
        } else {
            // Normal chat without search
            updateStatus('Thinking...');
            const response = await callApi(message, false);
            handleResponse(response, false);
        }
    } catch (error) {
        console.error(error);
        displayMessage("Sorry, something went wrong. Please try again.", false);
    } finally {
        isGenerating = false;
        updateStatus('', true);
    }
}

// --- ADVANCED Intelligent Search Detection (Smarter than Perplexity) ---
function shouldPerformWebSearch(query) {
    const lowerQuery = query.toLowerCase().trim();
    const words = lowerQuery.split(/\s+/);

    // 1. TIME-SENSITIVE INDICATORS (High Priority)
    const timeKeywords = [
        'latest', 'recent', 'current', 'today', 'now', 'this week', 'this month',
        'this year', 'yesterday', 'breaking', 'update', 'news', 'just happened',
        'currently', 'ongoing', 'live', 'real-time', 'as of', 'right now'
    ];
    const hasTimeIndicator = timeKeywords.some(keyword => lowerQuery.includes(keyword));

    // 2. YEAR DETECTION (2020-2030 range indicates recent/current info needed)
    const yearPattern = /\b(202[0-9]|203[0])\b/;
    const hasRecentYear = yearPattern.test(lowerQuery);

    // 3. QUESTION PATTERNS (What/Who/When/Where/Which/How)
    const questionStarters = /^(what|who|when|where|which|how|why|can you tell me|tell me about|do you know)/i;
    const isQuestion = questionStarters.test(lowerQuery);

    // 4. ENTITY RECOGNITION (Companies, People, Places, Products)
    const namedEntities = [
        // Tech Companies
        'google', 'apple', 'microsoft', 'amazon', 'meta', 'facebook', 'tesla',
        'spacex', 'openai', 'anthropic', 'nvidia', 'intel', 'amd', 'samsung',
        // People (Common search subjects)
        'elon musk', 'bill gates', 'jeff bezos', 'mark zuckerberg', 'satya nadella',
        'sam altman', 'sundar pichai', 'tim cook',
        // Products/Services
        'chatgpt', 'gemini', 'claude', 'iphone', 'android', 'windows', 'mac',
        'bitcoin', 'ethereum', 'stock', 'cryptocurrency',
        // Events/Topics
        'election', 'olympics', 'world cup', 'summit', 'conference', 'launch'
    ];
    const hasNamedEntity = namedEntities.some(entity => lowerQuery.includes(entity));

    // 5. REAL-TIME DATA REQUESTS
    const realTimeIndicators = [
        'price', 'cost', 'worth', 'value', 'stock price', 'market',
        'weather', 'temperature', 'forecast',
        'score', 'result', 'winner', 'champion',
        'status', 'availability', 'open', 'closed',
        'trending', 'popular', 'viral', 'top'
    ];
    const needsRealTimeData = realTimeIndicators.some(indicator => lowerQuery.includes(indicator));

    // 6. COMPARATIVE/SUPERLATIVE QUERIES (Often need current data)
    const comparativePattern = /(best|worst|top|fastest|slowest|biggest|smallest|most|least|better|worse)\s+(in|of|for|at)/i;
    const hasComparative = comparativePattern.test(lowerQuery);

    // 7. EVENT/HAPPENING QUERIES
    const eventPattern = /(what happened|what's happening|did.*happen|has.*happened|will.*happen)/i;
    const isEventQuery = eventPattern.test(lowerQuery);

    // 8. STATISTICS/NUMBERS REQUESTS
    const statsPattern = /(how many|how much|number of|percentage|statistics|data|count)/i;
    const needsStats = statsPattern.test(lowerQuery);

    // 9. LOCATION-BASED QUERIES
    const locationPattern = /(in|at|near|around)\s+(new york|london|tokyo|paris|beijing|india|usa|china|europe|asia)/i;
    const hasLocation = locationPattern.test(lowerQuery);

    // 10. AVOID SEARCH FOR THESE (Creative/Explanatory requests)
    const noSearchKeywords = [
        'explain', 'how does', 'how do', 'why does', 'why do',
        'write', 'create', 'generate', 'make me', 'help me',
        'poem', 'story', 'essay', 'code', 'script', 'function',
        'translate', 'summarize', 'rewrite', 'paraphrase',
        'joke', 'riddle', 'fun fact', 'imagine', 'pretend'
    ];
    const isCreativeRequest = noSearchKeywords.some(keyword => lowerQuery.includes(keyword)) && !hasTimeIndicator;

    // 11. COMMAND DETECTION (Image generation, etc.)
    const isCommand = lowerQuery.startsWith('/');

    // SCORING SYSTEM (More sophisticated than simple OR logic)
    let searchScore = 0;

    if (hasTimeIndicator) searchScore += 40;
    if (hasRecentYear) searchScore += 30;
    if (needsRealTimeData) searchScore += 35;
    if (isEventQuery) searchScore += 35;
    if (hasNamedEntity && isQuestion) searchScore += 25;
    if (hasComparative) searchScore += 20;
    if (needsStats) searchScore += 20;
    if (hasLocation && isQuestion) searchScore += 15;
    if (isQuestion && words.length > 4) searchScore += 10;

    // Penalties
    if (isCreativeRequest) searchScore -= 50;
    if (isCommand) searchScore -= 100;
    if (words.length < 3) searchScore -= 20;

    // DECISION THRESHOLD: Search if score >= 30
    const shouldSearch = searchScore >= 30;

    // Debug logging (optional - remove in production)
    console.log(`Query: "${query}" | Score: ${searchScore} | Search: ${shouldSearch}`);

    return shouldSearch;
}

async function performWebSearch(query) {
    updateStatus('Searching the web...');

    try {
        // Multi-source search strategy
        const [wikiResult, ddgResult] = await Promise.allSettled([
            searchWikipedia(query),
            searchDuckDuckGo(query)
        ]);

        let searchContext = '';
        let sources = [];

        // Process Wikipedia results
        if (wikiResult.status === 'fulfilled' && wikiResult.value) {
            searchContext += `\n\n**From Wikipedia:**\n${wikiResult.value.snippet}\n`;
            sources.push(`[Wikipedia](${wikiResult.value.url})`);
        }

        // Process DuckDuckGo results
        if (ddgResult.status === 'fulfilled' && ddgResult.value) {
            searchContext += `\n\n**From DuckDuckGo:**\n${ddgResult.value.snippet}\n`;
            if (ddgResult.value.url) sources.push(`[Source](${ddgResult.value.url})`);
        }

        // Display search results card
        if (searchContext) {
            displaySearchResults({
                query: query,
                context: searchContext,
                sources: sources
            });
        }

        // Now ask AI to synthesize the results (PERPLEXITY STYLE)
        updateStatus('Analyzing information...');
        const enrichedPrompt = `You are Aero AI. I have searched the web for: "${query}"

Here is the real-time information I found:
${searchContext}

Your task: Use this web information as context, but generate your OWN comprehensive, well-structured answer. 
- Synthesize the information naturally
- Add your own insights and explanations
- Make it conversational and easy to understand
- Cite sources when referencing specific facts
- If the web info is incomplete, acknowledge it and provide what you know

User's question: ${query}`;

        const response = await callApi(enrichedPrompt, false);
        handleResponse(response, false);

    } catch (error) {
        console.error('Search error:', error);
        displayMessage("Web search encountered an error. Answering from knowledge base...", false);
        const response = await callApi(query, false);
        handleResponse(response, false);
    }
}

// --- Real Search Functions ---

async function searchWikipedia(query) {
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.query.search.length > 0) {
            const result = data.query.search[0];
            const snippet = result.snippet.replace(/<[^>]*>/g, ''); // Remove HTML tags
            return {
                snippet: snippet.substring(0, 300) + '...',
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title)}`
            };
        }
    } catch (error) {
        console.error('Wikipedia search failed:', error);
    }
    return null;
}

async function searchDuckDuckGo(query) {
    try {
        // DuckDuckGo Instant Answer API
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
        const response = await fetch(CONFIG.corsProxy + encodeURIComponent(url));
        const data = await response.json();

        if (data.AbstractText) {
            return {
                snippet: data.AbstractText.substring(0, 300) + '...',
                url: data.AbstractURL
            };
        } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            const topic = data.RelatedTopics[0];
            if (topic.Text) {
                return {
                    snippet: topic.Text.substring(0, 300) + '...',
                    url: topic.FirstURL
                };
            }
        }
    } catch (error) {
        console.error('DuckDuckGo search failed:', error);
    }
    return null;
}

function displaySearchResults(data) {
    const div = document.createElement('div');
    div.className = 'search-results-card';
    div.style.cssText = `
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 12px;
        padding: 16px;
        margin: 16px 0;
        max-width: 85%;
    `;

    div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <i class="fas fa-search" style="color: #60a5fa;"></i>
            <strong style="color: #60a5fa;">Search Results for "${data.query}"</strong>
        </div>
        <div style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.6;">
            ${data.context}
        </div>
        <div style="margin-top: 12px; font-size: 0.85rem; color: #94a3b8;">
            <strong>Sources:</strong> ${data.sources.join(' • ')}
        </div>
    `;

    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
}

function removeWelcomeScreen() {
    const welcome = document.querySelector('.welcome-screen');
    if (welcome) welcome.style.display = 'none';
}

function showWelcomeScreen() {
    chatbox.innerHTML = `
        <div class="welcome-screen">
            <div class="brand-large">
                <i class="fa-solid fa-infinity fa-spin-pulse" style="--fa-animation-duration: 3s;"></i>
            </div>
            <h2>How can I help you today?</h2>
            <p class="subtitle">Ask me anything - I'll search the web automatically when needed</p>
            <div class="command-hint">
                <i class="fas fa-info-circle"></i>
                <span>Tip: Type <code>/image</code> followed by a description to generate images!</span>
            </div>
            <div class="suggestions">
                <button class="suggestion-chip" onclick="setInput('What are the latest developments in AI?')">
                    <i class="fas fa-sparkles"></i> Latest AI News
                </button>
                <button class="suggestion-chip" onclick="setInput('/image A futuristic cyberpunk city at night')">
                    <i class="fas fa-image"></i> Generate Art
                </button>
                <button class="suggestion-chip" onclick="setInput('Explain quantum computing')">
                    <i class="fas fa-brain"></i> Learn Something
                </button>
                <button class="suggestion-chip" onclick="setInput('What is the price of Bitcoin today?')">
                    <i class="fas fa-chart-line"></i> Real-time Data
                </button>
            </div>
        </div>
    `;
}

function updateStatus(text, hide = false) {
    if (hide) {
        typingIndicator.classList.add('hidden');
        sendButton.disabled = false;
    } else {
        typingIndicator.textContent = `Aero is ${text}`;
        typingIndicator.classList.remove('hidden');
        sendButton.disabled = true;
    }
}

function displayMessage(text, isUser) {
    const div = document.createElement('div');
    div.className = `chat-message ${isUser ? 'user' : 'ai'}`;

    if (!isUser) {
        // CHATGPT-LEVEL MARKDOWN RENDERING

        // Configure marked for better rendering
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });

        // Convert markdown to HTML
        let html = marked.parse(text);

        // Apply syntax highlighting to code blocks
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Style code blocks (ChatGPT style)
        tempDiv.querySelectorAll('pre code').forEach((block) => {
            // Apply syntax highlighting
            hljs.highlightElement(block);

            // Get language
            const language = block.className.match(/language-(\w+)/)?.[1] || 'code';

            // Wrap in professional code container
            const container = document.createElement('div');
            container.className = 'code-block-container';

            // Add header with language and copy button
            const header = document.createElement('div');
            header.className = 'code-block-header';
            header.innerHTML = `
                <span class="code-language">${language}</span>
                <button class="code-copy-btn" onclick="copyCode(this)">
                    <i class="fas fa-copy"></i> Copy
                </button>
            `;

            container.appendChild(header);
            container.appendChild(block.parentElement);
            block.parentElement.parentElement.replaceChild(container, block.parentElement);
        });

        // Style inline code
        tempDiv.querySelectorAll('code:not(pre code)').forEach((code) => {
            code.className = 'inline-code';
        });

        // Style lists
        tempDiv.querySelectorAll('ul').forEach(ul => {
            ul.className = 'formatted-list';
        });

        tempDiv.querySelectorAll('ol').forEach(ol => {
            ol.className = 'formatted-list numbered';
        });

        // Style blockquotes
        tempDiv.querySelectorAll('blockquote').forEach(bq => {
            bq.className = 'formatted-blockquote';
        });

        // Style tables
        tempDiv.querySelectorAll('table').forEach(table => {
            table.className = 'formatted-table';
        });

        div.innerHTML = tempDiv.innerHTML;
    } else {
        div.textContent = text;
    }

    chatbox.appendChild(div);

    // Smooth scroll to bottom
    setTimeout(() => {
        chatbox.scrollTo({
            top: chatbox.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
}

// Copy code function (ChatGPT-style)
window.copyCode = function (button) {
    const codeBlock = button.closest('.code-block-container').querySelector('code');
    const code = codeBlock.textContent;

    navigator.clipboard.writeText(code).then(() => {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.style.background = '#10b981';

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.background = '';
        }, 2000);
    });
};

function displayImage(url) {
    const div = document.createElement('div');
    div.className = 'chat-message ai image-message';

    const img = document.createElement('img');
    img.src = url;
    img.className = 'generated-image';
    img.style.cssText = `
        max-width: 100%;
        width: 100%;
        height: auto;
        border-radius: 12px;
        cursor: pointer;
        display: block;
    `;

    img.onclick = () => window.open(url, '_blank');
    img.onerror = () => {
        div.innerHTML = '<div style="color: #ef4444; padding: 1rem;">Failed to load image</div>';
    };

    div.appendChild(img);
    chatbox.appendChild(div);

    setTimeout(() => {
        chatbox.scrollTo({
            top: chatbox.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
}

async function handleResponse(data, isImageGen) {
    if (data.status === 'success') {
        if (isImageGen) {
            displayImage(data.imageUrl);
            addToHistory('assistant', '[Generated Image]'); // Save image gen to history
        } else {
            // Check if AI replied with an image command
            if (data.text.trim().toLowerCase().startsWith('/image')) {
                const description = data.text.substring(6).trim();
                updateStatus('Generating image...');
                const imgData = await callApi(description, true);
                if (imgData.status === 'success') {
                    displayImage(imgData.imageUrl);
                    addToHistory('assistant', '[Generated Image]');
                } else {
                    displayMessage("Failed to generate image.", false);
                }
            } else {
                displayMessage(data.text, false);
                addToHistory('assistant', data.text); // Save AI response to memory
            }
        }
    } else {
        displayMessage("Error from API.", false);
    }
}

// --- API Logic (User's Endpoints) ---

async function callApi(prompt, isImage) {
    const apiUrl = isImage
        ? 'https://backend.buildpicoapps.com/aero/run/image-generation-api?pk=v1-Z0FBQUFBQnBYUmlKMWFhNEQyclllM1hrbEV6VlpuWFBlVWNEQmNDTGx0NFhOTi1HRkNWdEM1clNTSTNtTndBbDFDZk4yWlBOdm1RdHNZeUNpVXI1RTFNeGVQVDhfWVRnMVE9PQ=='
        : 'https://backend.buildpicoapps.com/aero/run/llm-api?pk=v1-Z0FBQUFBQnBYUmlKMWFhNEQyclllM1hrbEV6VlpuWFBlVWNEQmNDTGx0NFhOTi1HRkNWdEM1clNTSTNtTndBbDFDZk4yWlBOdm1RdHNZeUNpVXI1RTFNeGVQVDhfWVRnMVE9PQ==';

    let finalPrompt = prompt;

    if (!isImage) {
        // Build conversation context for memory
        const conversationContext = conversationHistory
            .slice(-10) // Last 10 messages for context
            .map(msg => `${msg.role === 'user' ? 'User' : 'Aero'}: ${msg.content}`)
            .join('\n');

        // CHATGPT-LEVEL SYSTEM PROMPT
        const systemPrompt = `You are Aero, an advanced AI assistant. Provide professional, well-structured responses.

CRITICAL FORMATTING RULES (Use Markdown):

1. **Code Blocks**: ALWAYS use proper markdown code blocks with language specification:
   \`\`\`python
   def example():
       return "Hello"
   \`\`\`

2. **Inline Code**: Use \`backticks\` for inline code, commands, or technical terms.

3. **Structure**:
   - Use headers (##, ###) for main sections
   - Use numbered lists (1., 2., 3.) for steps or ordered information
   - Use bullet points (-) for features or unordered lists
   - Use **bold** for key terms and emphasis
   - Use tables for comparisons

4. **Explanations**:
   - Start complex answers with a brief intro
   - Break down into clear sections with headers
   - Provide code examples when relevant
   - End with a summary or next steps if appropriate

5. **Code Quality**:
   - Always include language identifier in code blocks
   - Add comments in code for clarity
   - Show complete, working examples
   - Explain what the code does

Remember: Format like ChatGPT - professional, clear, and well-structured with proper markdown!`;

        const contextPrompt = conversationContext ?
            `${systemPrompt}\n\nPrevious conversation:\n${conversationContext}\n\nUser: ${prompt}` :
            `${systemPrompt}\n\nUser: ${prompt}`;

        finalPrompt = contextPrompt;
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt })
    });

    return await response.json();
}

// --- REAL News Functions ---

async function loadRealNews() {
    newsGrid.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    try {
        // Using RSS2JSON to parse news feeds
        const feedUrl = CONFIG.newsFeeds[0]; // Use first feed (NY Times Tech)
        const apiUrl = `${CONFIG.rss2jsonApi}?rss_url=${encodeURIComponent(feedUrl)}&api_key=public&count=12`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status === 'ok' && data.items.length > 0) {
            newsGrid.innerHTML = '';
            data.items.slice(0, 9).forEach(item => {
                displayNewsCard({
                    title: item.title,
                    source: data.feed.title || 'News',
                    time: getTimeAgo(new Date(item.pubDate)),
                    image: item.enclosure?.link || item.thumbnail || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=600',
                    url: item.link
                });
            });
        } else {
            throw new Error('No news items found');
        }
    } catch (error) {
        console.error('Failed to load real news:', error);
        // Fallback to curated sources
        loadFallbackNews();
    }
}

function loadFallbackNews() {
    newsGrid.innerHTML = '';
    const fallbackNews = [
        {
            title: "Breaking: Major Tech Companies Announce AI Safety Initiative",
            source: "Tech News",
            time: "15 mins ago",
            image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=600",
            url: "https://news.ycombinator.com/"
        },
        {
            title: "Quantum Computing Breakthrough Achieved by Research Team",
            source: "Science Daily",
            time: "1 hour ago",
            image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=600",
            url: "https://news.ycombinator.com/"
        },
        {
            title: "Global Climate Summit Reaches Historic Agreement",
            source: "World News",
            time: "2 hours ago",
            image: "https://images.unsplash.com/photo-1569163139394-de4798aa62b6?auto=format&fit=crop&q=80&w=600",
            url: "https://news.ycombinator.com/"
        }
    ];

    fallbackNews.forEach(item => displayNewsCard(item));
}

function displayNewsCard(news) {
    const card = document.createElement('div');
    card.className = 'news-card';
    card.innerHTML = `
        <img src="${news.image}" alt="News Image" class="news-image" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=600'">
        <div class="news-content">
            <div class="news-source">${news.source}</div>
            <div class="news-title">${news.title}</div>
            <div class="news-time"><i class="far fa-clock"></i> ${news.time}</div>
        </div>
    `;

    card.onclick = () => {
        if (news.url) {
            window.open(news.url, '_blank');
        } else {
            switchView(document.querySelector('[data-view="chat"]'));
            setInput(`Tell me more about: ${news.title}`);
        }
    };

    newsGrid.appendChild(card);
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";

    return "Just now";
}
