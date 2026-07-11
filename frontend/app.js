// Global Application State
let state = {
    activeRunId: null,
    activeRunData: null,
    history: [],
    sentimentChart: null,
    pollInterval: null
};

// UI Elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const analysisForm = document.getElementById('analysis-form');
const youtubeUrlInput = document.getElementById('youtube-url-input');
const progressContainer = document.getElementById('progress-container');
const progressStepText = document.getElementById('progress-step-text');
const progressPercentText = document.getElementById('progress-percent-text');
const progressBarFill = document.getElementById('progress-bar-fill');

const errorCard = document.getElementById('error-card');
const errorDetailsText = document.getElementById('error-details-text');
const closeErrorBtn = document.getElementById('close-error-btn');

const resultsContainer = document.getElementById('results-container');
const historyList = document.getElementById('history-list');

// Speech Info Elements
const speechThumbnail = document.getElementById('speech-thumbnail');
const speechTitle = document.getElementById('speech-title');
const speechUploader = document.getElementById('speech-uploader');
const speechDurationBadge = document.getElementById('speech-duration-badge');
const speechLangBadge = document.getElementById('speech-lang-badge');
const speechSourceLink = document.getElementById('speech-source-link');
const deleteAnalysisBtn = document.getElementById('delete-analysis-btn');

// Stats Elements
const statPositiveVal = document.getElementById('stat-positive-val');
const statNeutralVal = document.getElementById('stat-neutral-val');
const statNegativeVal = document.getElementById('stat-negative-val');
const statOverallVal = document.getElementById('stat-overall-val');
const statOverallText = document.getElementById('stat-overall-text');

// Transcript & Filter Elements
const transcriptTableBody = document.getElementById('transcript-table-body');
const filterBtns = document.querySelectorAll('.filter-btn');
const downloadResultsBtn = document.getElementById('download-results-btn');

// Search Elements
const semanticSearchForm = document.getElementById('semantic-search-form');
const semanticQueryInput = document.getElementById('semantic-query-input');
const similarityResults = document.getElementById('similarity-results');

// Initial Setup on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchHistory();
    setupEventListeners();
});

function setupEventListeners() {
    // Theme toggler
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Form submit for analysis
    analysisForm.addEventListener('submit', handleAnalysisSubmit);

    // Error banner close
    closeErrorBtn.addEventListener('click', hideError);

    // Filters for transcript
    filterBtns.forEach(btn => {
        btn.addEventListener('click', handleFilterClick);
    });

    // Semantic search
    semanticSearchForm.addEventListener('submit', handleSemanticSearch);

    // Export button
    downloadResultsBtn.addEventListener('click', downloadJsonReport);

    // Delete analysis button
    deleteAnalysisBtn.addEventListener('click', handleDeleteAnalysis);
}

// Theme Toggling
function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    themeToggleBtn.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// Fetch and Render History Sidebar
async function fetchHistory() {
    try {
        const response = await fetch('/api/history');
        if (!response.ok) throw new Error("Failed to fetch history");
        
        state.history = await response.json();
        renderHistory();
    } catch (error) {
        console.error("Error loading analysis history:", error);
    }
}

function renderHistory() {
    if (state.history.length === 0) {
        historyList.innerHTML = '<li class="history-empty">No speeches analyzed yet</li>';
        return;
    }

    historyList.innerHTML = '';
    state.history.forEach(item => {
        const li = document.createElement('li');
        li.className = `history-item ${state.activeRunId === item.id ? 'active' : ''}`;
        
        const timestamp = new Date(item.timestamp).toLocaleString();
        const durationStr = formatTime(item.duration);
        
        li.innerHTML = `
            <h4>${escapeHtml(item.title)}</h4>
            <p>
                <span><i class="fa-solid fa-user"></i> ${escapeHtml(item.uploader)}</span>
                <span>${durationStr}</span>
            </p>
        `;
        
        li.addEventListener('click', () => {
            loadRunDetails(item.id);
        });
        
        historyList.appendChild(li);
    });
}

// Load Specific Run Details
async function loadRunDetails(runId) {
    try {
        state.activeRunId = runId;
        renderHistory(); // Refresh active list item styling
        
        const response = await fetch(`/api/results/${runId}`);
        if (!response.ok) throw new Error("Failed to load run details");
        
        state.activeRunData = await response.json();
        renderDashboard();
    } catch (error) {
        console.error("Error loading run details:", error);
        showError(`Could not load run results: ${error.message}`);
    }
}

// Render Dashboard UI with Active Run Data
function renderDashboard() {
    const run = state.activeRunData;
    if (!run) return;

    // Show results container
    resultsContainer.classList.remove('hidden');
    
    // Scroll dashboard into view smoothly
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Video meta info
    speechThumbnail.src = run.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=60";
    speechTitle.textContent = run.title;
    speechUploader.innerHTML = `<i class="fa-solid fa-user"></i> ${escapeHtml(run.uploader)}`;
    speechDurationBadge.innerHTML = `<i class="fa-solid fa-clock"></i> ${formatTime(run.duration)}`;
    speechLangBadge.innerHTML = `<i class="fa-solid fa-language"></i> ${run.language.toUpperCase()}`;
    speechSourceLink.href = run.url;

    // Stats
    const sentiment = run.overall_sentiment;
    statPositiveVal.textContent = `${sentiment.positive_percentage}%`;
    statNeutralVal.textContent = `${sentiment.neutral_percentage}%`;
    statNegativeVal.textContent = `${sentiment.negative_percentage}%`;
    
    const avgScore = sentiment.average_score;
    statOverallVal.textContent = avgScore.toFixed(2);

    // Overall label text based on sentiment score
    let labelText = "Neutral tone";
    let labelColor = "var(--text-muted)";
    if (avgScore > 0.2) {
        labelText = avgScore > 0.6 ? "Strongly Positive tone" : "Mildly Positive tone";
        labelColor = "var(--positive)";
    } else if (avgScore < -0.2) {
        labelText = avgScore < -0.6 ? "Strongly Negative tone" : "Mildly Negative tone";
        labelColor = "var(--negative)";
    }
    statOverallText.textContent = labelText;
    statOverallText.style.color = labelColor;

    // Render components
    renderSentimentChart();
    renderTranscriptTable(run.segments);
    
    // Clear similarity search
    semanticQueryInput.value = '';
    similarityResults.innerHTML = '<p class="placeholder-text">Type search term above to query similarities.</p>';
}

// Render Chart.js Sentiment Trend Timeline
function renderSentimentChart() {
    const ctx = document.getElementById('sentiment-timeline-chart').getContext('2d');
    const segments = state.activeRunData.segments;
    
    // Prepare labels (start times) and values (sentiment scores)
    const labels = segments.map(seg => formatTime(seg.start));
    const scores = segments.map(seg => seg.sentiment.score);
    
    // Destroy previous chart instance if exists
    if (state.sentimentChart) {
        state.sentimentChart.destroy();
    }

    // Determine colors based on theme
    const isLightTheme = document.body.classList.contains('light-theme');
    const gridColor = isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLightTheme ? '#475569' : '#a1a1aa';

    state.sentimentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tone Index',
                data: scores,
                borderColor: '#8b5cf6',
                borderWidth: 2,
                pointBackgroundColor: segments.map(seg => {
                    const l = seg.sentiment.label;
                    if (l === 'POSITIVE') return '#10b981';
                    if (l === 'NEGATIVE') return '#f43f5e';
                    return '#64748b';
                }),
                pointBorderWidth: 1,
                pointRadius: 4,
                pointHoverRadius: 6,
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const segment = segments[index];
                            return `Tone: ${segment.sentiment.label} (${segment.sentiment.score.toFixed(2)})`;
                        },
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            const text = segments[index].text;
                            return text.length > 50 ? text.substring(0, 50) + "..." : text;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        maxTicksLimit: 12
                    }
                },
                y: {
                    min: -1.1,
                    max: 1.1,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        stepSize: 0.5,
                        callback: function(value) {
                            if (value === 1) return 'Positive (1.0)';
                            if (value === 0) return 'Neutral (0.0)';
                            if (value === -1) return 'Negative (-1.0)';
                            return value.toFixed(1);
                        }
                    }
                }
            },
            onClick: (e, activeEls) => {
                if (activeEls.length > 0) {
                    const index = activeEls[0].index;
                    scrollToTranscriptSegment(segments[index].id);
                }
            }
        }
    });
}

// Render Transcript Table
function renderTranscriptTable(segments) {
    transcriptTableBody.innerHTML = '';
    
    segments.forEach(seg => {
        const tr = document.createElement('tr');
        tr.id = `transcript-seg-${seg.id}`;
        tr.setAttribute('data-sentiment', seg.sentiment.label);
        
        const timestampStr = `${formatTime(seg.start)} - ${formatTime(seg.end)}`;
        const pillClass = seg.sentiment.label.toLowerCase();
        
        tr.innerHTML = `
            <td class="time-stamp">${timestampStr}</td>
            <td class="seg-text">${escapeHtml(seg.text)}</td>
            <td style="text-align: center;">
                <span class="sentiment-pill ${pillClass}">${seg.sentiment.label}</span>
            </td>
            <td style="text-align: right;" class="confidence-val">
                ${Math.round(seg.sentiment.confidence * 100)}%
            </td>
        `;
        
        transcriptTableBody.appendChild(tr);
    });

    // Reset filter buttons active state
    filterBtns.forEach(btn => btn.classList.remove('active'));
    document.getElementById('filter-all').classList.add('active');
}

// Handle transcript filtering
function handleFilterClick(e) {
    const filterType = e.currentTarget.getAttribute('data-filter');
    
    // Toggle active filter button style
    filterBtns.forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');

    const rows = transcriptTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const sentiment = row.getAttribute('data-sentiment');
        if (filterType === 'all' || sentiment === filterType) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
}

// Start Processing Analysis
async function handleAnalysisSubmit(e) {
    e.preventDefault();
    hideError();
    
    const url = youtubeUrlInput.value.trim();
    if (!url) return;

    // Show Progress State
    progressContainer.classList.remove('hidden');
    updateProgress("Initializing pipeline...", 0);
    submitAnalysisBtnDisabled(true);

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        if (!response.ok) throw new Error("Failed to initialize backend job");
        
        const data = await response.json();
        pollTaskStatus(data.task_id);
        
    } catch (error) {
        console.error("Error submitting YouTube URL:", error);
        showError(`Pipeline Setup Failed: ${error.message}`);
        progressContainer.classList.add('hidden');
        submitAnalysisBtnDisabled(false);
    }
}

// Poll Task Status in the background
function pollTaskStatus(taskId) {
    if (state.pollInterval) clearInterval(state.pollInterval);
    
    state.pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/status/${taskId}`);
            if (!response.ok) throw new Error("Failed to check status");
            
            const task = await response.json();
            updateProgress(task.step, task.progress);
            
            if (task.status === 'completed') {
                clearInterval(state.pollInterval);
                progressContainer.classList.add('hidden');
                submitAnalysisBtnDisabled(false);
                youtubeUrlInput.value = '';
                
                await fetchHistory(); // Refresh history
                loadRunDetails(task.result_id); // Load the completed run
            } else if (task.status === 'failed') {
                clearInterval(state.pollInterval);
                progressContainer.classList.add('hidden');
                submitAnalysisBtnDisabled(false);
                showError(`Pipeline Execution Failed: ${task.error}`);
            }
        } catch (error) {
            console.error("Error polling status:", error);
            // Don't clear interval immediately as it might be transient network issue
        }
    }, 1500);
}

function updateProgress(step, percent) {
    progressStepText.textContent = step;
    progressPercentText.textContent = `${percent}%`;
    progressBarFill.style.width = `${percent}%`;
}

function submitAnalysisBtnDisabled(disabled) {
    const btn = document.getElementById('submit-analysis-btn');
    btn.disabled = disabled;
    btn.querySelector('.btn-text').textContent = disabled ? "Processing..." : "Process Video";
}

// Semantic Similarity Search
async function handleSemanticSearch(e) {
    e.preventDefault();
    const query = semanticQueryInput.value.trim();
    const runId = state.activeRunId;
    
    if (!query || !runId) return;

    similarityResults.innerHTML = '<div class="placeholder-text"><i class="fa-solid fa-circle-notch fa-spin"></i> Embedding query & computing similarities...</div>';

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ run_id: runId, query: query })
        });
        
        if (!response.ok) throw new Error("Search query failed");
        
        const results = await response.json();
        renderSimilarityResults(results);
    } catch (error) {
        console.error("Semantic search error:", error);
        similarityResults.innerHTML = `<div class="placeholder-text" style="color: var(--negative);">Search error: ${error.message}</div>`;
    }
}

function renderSimilarityResults(results) {
    if (results.length === 0) {
        similarityResults.innerHTML = '<p class="placeholder-text">No matches found.</p>';
        return;
    }

    similarityResults.innerHTML = '';
    
    // Take top 8 matches
    const topResults = results.slice(0, 8);
    
    topResults.forEach(item => {
        const div = document.createElement('div');
        div.className = 'sim-item';
        
        const scorePercent = Math.round(item.similarity * 100);
        const timestampStr = `${formatTime(item.start)} - ${formatTime(item.end)}`;
        
        div.innerHTML = `
            <div class="sim-item-header">
                <span><i class="fa-solid fa-clock"></i> ${timestampStr}</span>
                <span class="sim-score-badge">${scorePercent}% Match</span>
            </div>
            <div class="sim-item-text">"${escapeHtml(item.text)}"</div>
        `;
        
        div.addEventListener('click', () => {
            scrollToTranscriptSegment(item.id);
        });
        
        similarityResults.appendChild(div);
    });
}

// Scroll & Highlight dynamic transcription segment
function scrollToTranscriptSegment(segmentId) {
    const row = document.getElementById(`transcript-seg-${segmentId}`);
    if (!row) return;

    // Reset filters if segment is filtered out
    const filterAllBtn = document.getElementById('filter-all');
    if (!filterAllBtn.classList.contains('active')) {
        filterAllBtn.click();
    }

    // Scroll container
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Trigger highlight visual cue
    row.classList.add('highlighted');
    setTimeout(() => {
        row.classList.remove('highlighted');
    }, 2500);
}

// Delete Run Analysis
async function handleDeleteAnalysis() {
    const runId = state.activeRunId;
    if (!runId) return;

    if (!confirm("Are you sure you want to delete this analysis run? This cannot be undone.")) {
        return;
    }

    try {
        const response = await fetch(`/api/results/${runId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error("Failed to delete analysis");
        
        resultsContainer.classList.add('hidden');
        state.activeRunId = null;
        state.activeRunData = null;
        
        await fetchHistory();
    } catch (error) {
        console.error("Error deleting analysis:", error);
        showError(`Failed to delete: ${error.message}`);
    }
}

// Export JSON Data
function downloadJsonReport() {
    const run = state.activeRunData;
    if (!run) return;
    
    const jsonStr = JSON.stringify(run, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `speech_report_${run.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Helper Utilities
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}

function showError(msg) {
    errorDetailsText.textContent = msg;
    errorCard.classList.remove('hidden');
    // Scroll error into view
    errorCard.scrollIntoView({ behavior: 'smooth' });
}

function hideError() {
    errorCard.classList.add('hidden');
}
