// ============================================
// Job Notification Tracker - Enhanced Router
// With Preference Logic and Match Scoring
// ============================================

// Global state
let allJobs = [];
let filteredJobs = [];
let savedJobIds = [];
let userPreferences = null;
let showOnlyMatches = false;
let jobStatus = {}; // { jobId: status }
let statusHistory = []; // Array of { jobId, status, timestamp }
let testChecklist = {}; // { testId: boolean }
let proofArtifacts = {
    lovableLink: '',
    githubLink: '',
    deployedLink: ''
};
let currentFilters = {
    keyword: '',
    location: 'all',
    mode: 'all',
    experience: 'all',
    source: 'all',
    status: 'all',
    sort: 'latest'
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Load jobs data
    allJobs = typeof jobsData !== 'undefined' ? jobsData : [];

    // Load saved jobs from localStorage
    const saved = localStorage.getItem('savedJobs');
    savedJobIds = saved ? JSON.parse(saved) : [];

    // Load job status from localStorage
    const status = localStorage.getItem('jobTrackerStatus');
    jobStatus = status ? JSON.parse(status) : {};

    // Load status history from localStorage
    const history = localStorage.getItem('jobTrackerStatusHistory');
    statusHistory = history ? JSON.parse(history) : [];

    // Load test checklist from localStorage
    const checklist = localStorage.getItem('jobTrackerTestChecklist');
    testChecklist = checklist ? JSON.parse(checklist) : {};

    // Load proof artifacts from localStorage
    const artifacts = localStorage.getItem('jobTrackerProofArtifacts');
    proofArtifacts = artifacts ? JSON.parse(artifacts) : {
        lovableLink: '',
        githubLink: '',
        deployedLink: ''
    };

    // Load user preferences from localStorage
    const prefs = localStorage.getItem('jobTrackerPreferences');
    userPreferences = prefs ? JSON.parse(prefs) : null;

    // Calculate match scores for all jobs
    if (userPreferences) {
        allJobs = allJobs.map(job => ({
            ...job,
            matchScore: calculateMatchScore(job, userPreferences)
        }));
    }

    filteredJobs = [...allJobs];

    // Initialize router
    initRouter();
});

// ============================================
// MATCH SCORE ENGINE
// ============================================

function calculateMatchScore(job, preferences) {
    if (!preferences) return 0;

    let score = 0;

    // +25 if any roleKeyword appears in job.title (case-insensitive)
    if (preferences.roleKeywords && preferences.roleKeywords.length > 0) {
        const titleLower = job.title.toLowerCase();
        const hasKeywordInTitle = preferences.roleKeywords.some(keyword =>
            titleLower.includes(keyword.toLowerCase().trim())
        );
        if (hasKeywordInTitle) score += 25;
    }

    // +15 if any roleKeyword appears in job.description
    if (preferences.roleKeywords && preferences.roleKeywords.length > 0) {
        const descLower = job.description.toLowerCase();
        const hasKeywordInDesc = preferences.roleKeywords.some(keyword =>
            descLower.includes(keyword.toLowerCase().trim())
        );
        if (hasKeywordInDesc) score += 15;
    }

    // +15 if job.location matches preferredLocations
    if (preferences.preferredLocations && preferences.preferredLocations.length > 0) {
        const locationMatches = preferences.preferredLocations.some(loc =>
            loc.trim().toLowerCase() === job.location.toLowerCase()
        );
        if (locationMatches) score += 15;
    }

    // +10 if job.mode matches preferredMode
    if (preferences.preferredMode && preferences.preferredMode.length > 0) {
        const modeMatches = preferences.preferredMode.some(mode =>
            mode.toLowerCase() === job.mode.toLowerCase()
        );
        if (modeMatches) score += 10;
    }

    // +10 if job.experience matches experienceLevel
    if (preferences.experienceLevel && preferences.experienceLevel === job.experience) {
        score += 10;
    }

    // +15 if overlap between job.skills and user.skills (any match)
    if (preferences.skills && preferences.skills.length > 0 && job.skills && job.skills.length > 0) {
        const userSkillsLower = preferences.skills.map(s => s.toLowerCase().trim());
        const jobSkillsLower = job.skills.map(s => s.toLowerCase().trim());
        const hasSkillOverlap = userSkillsLower.some(skill =>
            jobSkillsLower.includes(skill)
        );
        if (hasSkillOverlap) score += 15;
    }

    // +5 if postedDaysAgo <= 2
    if (job.postedDaysAgo <= 2) {
        score += 5;
    }

    // +5 if source is LinkedIn
    if (job.source === 'LinkedIn') {
        score += 5;
    }

    // Cap score at 100
    return Math.min(score, 100);
}

// Get match score badge class
function getMatchScoreBadgeClass(score) {
    if (score >= 80) return 'match-badge--excellent';
    if (score >= 60) return 'match-badge--good';
    if (score >= 40) return 'match-badge--fair';
    return 'match-badge--low';
}

// Route definitions
const routes = {
    '/': {
        title: 'Dashboard',
        render: () => createDashboardPage()
    },
    '/dashboard': {
        title: 'Dashboard',
        render: () => createDashboardPage()
    },
    '/saved': {
        title: 'Saved',
        render: () => createSavedPage()
    },
    '/digest': {
        title: 'Digest',
        render: () => createDigestPage()
    },
    '/settings': {
        title: 'Settings',
        render: () => createSettingsPage()
    },
    '/proof': {
        title: 'Proof',
        render: () => createProofPage()
    },
    '/jt/07-test': {
        title: 'Test Checklist',
        render: () => createTestChecklistPage()
    },
    '/jt/08-ship': {
        title: 'Ship',
        render: () => createDashboardPage() // Placeholder for ship page, or createShipPage if it exists
    }
};

// ============================================
// DASHBOARD PAGE
// ============================================

function createDashboardPage() {
    applyFilters();

    const preferenceBanner = !userPreferences ? `
        <div class="preference-banner">
            <p class="preference-banner__message">Set your preferences to activate intelligent matching.</p>
            <button class="btn btn--secondary btn--small" onclick="navigateTo('/settings')">Configure Preferences</button>
        </div>
    ` : '';

    const matchToggle = userPreferences ? `
        <div class="match-toggle">
            <label class="toggle-label">
                <input type="checkbox" id="show-matches-toggle" ${showOnlyMatches ? 'checked' : ''} onchange="toggleShowOnlyMatches(this.checked)">
                <span>Show only jobs above my threshold (${userPreferences.minMatchScore}%)</span>
            </label>
        </div>
    ` : '';

    const filterBar = createFilterBar();

    let jobsHtml;
    if (filteredJobs.length > 0) {
        jobsHtml = filteredJobs.map(job => createJobCard(job)).join('');
    } else {
        const emptyMessage = userPreferences && showOnlyMatches
            ? 'No roles match your criteria. Adjust filters or lower threshold.'
            : 'No jobs match your filters';
        jobsHtml = `<div class="empty-state"><p class="empty-state__message">${emptyMessage}</p></div>`;
    }

    return `
        <div class="dashboard-page">
            <div class="page-header">
                <h1 class="page-header__title">Dashboard</h1>
                <p class="page-header__subtitle">Your matched job opportunities</p>
            </div>
            
            ${preferenceBanner}
            ${matchToggle}
            ${filterBar}
            
            <div class="jobs-grid">
                ${jobsHtml}
            </div>
        </div>
        
        <div id="job-modal" class="modal">
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div id="modal-body"></div>
            </div>
        </div>
    `;
}

// Create filter bar
function createFilterBar() {
    const sortOptions = userPreferences
        ? `
            <option value="latest" ${currentFilters.sort === 'latest' ? 'selected' : ''}>Latest First</option>
            <option value="oldest" ${currentFilters.sort === 'oldest' ? 'selected' : ''}>Oldest First</option>
            <option value="matchScore" ${currentFilters.sort === 'matchScore' ? 'selected' : ''}>Match Score</option>
            <option value="salary" ${currentFilters.sort === 'salary' ? 'selected' : ''}>Salary</option>
        `
        : `
            <option value="latest" ${currentFilters.sort === 'latest' ? 'selected' : ''}>Latest First</option>
            <option value="oldest" ${currentFilters.sort === 'oldest' ? 'selected' : ''}>Oldest First</option>
            <option value="salary" ${currentFilters.sort === 'salary' ? 'selected' : ''}>Salary</option>
        `;

    return `
        <div class="filter-bar">
            <div class="filter-group">
                <input 
                    type="text" 
                    id="filter-keyword" 
                    class="filter-input" 
                    placeholder="Search by title or company..."
                    value="${currentFilters.keyword}"
                    onkeyup="handleFilterChange('keyword', this.value)"
                >
            </div>
            
            <div class="filter-group">
                <select id="filter-location" class="filter-select" onchange="handleFilterChange('location', this.value)">
                    <option value="all">All Locations</option>
                    <option value="Bangalore" ${currentFilters.location === 'Bangalore' ? 'selected' : ''}>Bangalore</option>
                    <option value="Hyderabad" ${currentFilters.location === 'Hyderabad' ? 'selected' : ''}>Hyderabad</option>
                    <option value="Pune" ${currentFilters.location === 'Pune' ? 'selected' : ''}>Pune</option>
                    <option value="Chennai" ${currentFilters.location === 'Chennai' ? 'selected' : ''}>Chennai</option>
                    <option value="Mumbai" ${currentFilters.location === 'Mumbai' ? 'selected' : ''}>Mumbai</option>
                    <option value="Noida" ${currentFilters.location === 'Noida' ? 'selected' : ''}>Noida</option>
                    <option value="Gurgaon" ${currentFilters.location === 'Gurgaon' ? 'selected' : ''}>Gurgaon</option>
                </select>
            </div>
            
            <div class="filter-group">
                <select id="filter-mode" class="filter-select" onchange="handleFilterChange('mode', this.value)">
                    <option value="all">All Modes</option>
                    <option value="Remote" ${currentFilters.mode === 'Remote' ? 'selected' : ''}>Remote</option>
                    <option value="Hybrid" ${currentFilters.mode === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
                    <option value="Onsite" ${currentFilters.mode === 'Onsite' ? 'selected' : ''}>Onsite</option>
                </select>
            </div>
            
            <div class="filter-group">
                <select id="filter-experience" class="filter-select" onchange="handleFilterChange('experience', this.value)">
                    <option value="all">All Experience</option>
                    <option value="Fresher" ${currentFilters.experience === 'Fresher' ? 'selected' : ''}>Fresher</option>
                    <option value="0-1" ${currentFilters.experience === '0-1' ? 'selected' : ''}>0-1 Years</option>
                    <option value="1-3" ${currentFilters.experience === '1-3' ? 'selected' : ''}>1-3 Years</option>
                    <option value="3-5" ${currentFilters.experience === '3-5' ? 'selected' : ''}>3-5 Years</option>
                </select>
            </div>
            
            <div class="filter-group">
                <select id="filter-source" class="filter-select" onchange="handleFilterChange('source', this.value)">
                    <option value="all">All Sources</option>
                    <option value="LinkedIn" ${currentFilters.source === 'LinkedIn' ? 'selected' : ''}>LinkedIn</option>
                    <option value="Naukri" ${currentFilters.source === 'Naukri' ? 'selected' : ''}>Naukri</option>
                    <option value="Indeed" ${currentFilters.source === 'Indeed' ? 'selected' : ''}>Indeed</option>
                </select>
            </div>
            
            <div class="filter-group">
                <select id="filter-status" class="filter-select" onchange="handleFilterChange('status', this.value)">
                    <option value="all">All Status</option>
                    <option value="Not Applied" ${currentFilters.status === 'Not Applied' ? 'selected' : ''}>Not Applied</option>
                    <option value="Applied" ${currentFilters.status === 'Applied' ? 'selected' : ''}>Applied</option>
                    <option value="Rejected" ${currentFilters.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                    <option value="Selected" ${currentFilters.status === 'Selected' ? 'selected' : ''}>Selected</option>
                </select>
            </div>
            
            <div class="filter-group">
                <select id="filter-sort" class="filter-select" onchange="handleFilterChange('sort', this.value)">
                    ${sortOptions}
                </select>
            </div>
        </div>
    `;
}

// Create job card
function createJobCard(job) {
    const isSaved = savedJobIds.includes(job.id);
    const daysText = job.postedDaysAgo === 0 ? 'Today' :
        job.postedDaysAgo === 1 ? '1 day ago' :
            `${job.postedDaysAgo} days ago`;

    const matchScoreBadge = userPreferences && job.matchScore !== undefined ? `
        <span class="match-badge ${getMatchScoreBadgeClass(job.matchScore)}">${job.matchScore}%</span>
    ` : '';

    // Get current status (default to "Not Applied")
    const currentStatus = jobStatus[job.id] || 'Not Applied';
    const statusClass = getStatusClass(currentStatus);

    return `
        <div class="job-card">
            <div class="job-card__header">
                <div class="job-card__title-row">
                    <h3 class="job-card__title">${job.title}</h3>
                    <div class="job-card__badges">
                        ${matchScoreBadge}
                        <span class="source-badge source-badge--${job.source.toLowerCase()}">${job.source}</span>
                    </div>
                </div>
                <p class="job-card__company">${job.company}</p>
            </div>
            
            <div class="job-card__details">
                <span class="job-detail">
                    <svg class="job-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 8C9.66 8 11 6.66 11 5C11 3.34 9.66 2 8 2C6.34 2 5 3.34 5 5C5 6.66 6.34 8 8 8ZM8 9.5C5.67 9.5 1 10.67 1 13V14.5H15V13C15 10.67 10.33 9.5 8 9.5Z" fill="currentColor"/>
                    </svg>
                    ${job.location} • ${job.mode}
                </span>
                <span class="job-detail">
                    <svg class="job-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1C4.13 1 1 4.13 1 8C1 11.87 4.13 15 8 15C11.87 15 15 11.87 15 8C15 4.13 11.87 1 8 1ZM8 13.5C4.96 13.5 2.5 11.04 2.5 8C2.5 4.96 4.96 2.5 8 2.5C11.04 2.5 13.5 4.96 13.5 8C13.5 11.04 11.04 13.5 8 13.5Z" fill="currentColor"/>
                        <path d="M8.5 4.5H7V8.5L10.5 10.5L11 9.5L8.5 7.75V4.5Z" fill="currentColor"/>
                    </svg>
                    ${job.experience}
                </span>
                <span class="job-detail job-detail--posted">${daysText}</span>
            </div>
            
            <div class="job-card__salary">${job.salaryRange}</div>
            
            <div class="job-card__status">
                <label class="status-label">Status:</label>
                <div class="status-buttons">
                    <button class="status-btn ${currentStatus === 'Not Applied' ? 'status-btn--active status-btn--neutral' : 'status-btn--neutral'}" onclick="changeJobStatus('${job.id}', 'Not Applied')">Not Applied</button>
                    <button class="status-btn ${currentStatus === 'Applied' ? 'status-btn--active status-btn--blue' : 'status-btn--blue'}" onclick="changeJobStatus('${job.id}', 'Applied')">Applied</button>
                    <button class="status-btn ${currentStatus === 'Rejected' ? 'status-btn--active status-btn--red' : 'status-btn--red'}" onclick="changeJobStatus('${job.id}', 'Rejected')">Rejected</button>
                    <button class="status-btn ${currentStatus === 'Selected' ? 'status-btn--active status-btn--green' : 'status-btn--green'}" onclick="changeJobStatus('${job.id}', 'Selected')">Selected</button>
                </div>
            </div>
            
            <div class="job-card__actions">
                <button class="btn btn--secondary btn--small" onclick="viewJob('${job.id}')">View</button>
                <button class="btn btn--secondary btn--small ${isSaved ? 'btn--saved' : ''}" onclick="toggleSaveJob('${job.id}')">
                    ${isSaved ? 'Saved ✓' : 'Save'}
                </button>
                <button class="btn btn--primary btn--small" onclick="applyJob('${job.applyUrl}')">Apply</button>
            </div>
        </div>
    `;
}

// ============================================
// SAVED PAGE
// ============================================

function createSavedPage() {
    const savedJobs = allJobs.filter(job => savedJobIds.includes(job.id));

    if (savedJobs.length === 0) {
        return `
            <div class="saved-page">
                <div class="page-header">
                    <h1 class="page-header__title">Saved</h1>
                    <p class="page-header__subtitle">Jobs you've bookmarked for later</p>
                </div>
                
                <div class="empty-state">
                    <p class="empty-state__message">No saved jobs yet</p>
                    <button class="btn btn--secondary" onclick="navigateTo('/dashboard')">Browse Jobs</button>
                </div>
            </div>
        `;
    }

    const jobsHtml = savedJobs.map(job => createJobCard(job)).join('');

    return `
        <div class="saved-page">
            <div class="page-header">
                <h1 class="page-header__title">Saved</h1>
                <p class="page-header__subtitle">${savedJobs.length} job${savedJobs.length !== 1 ? 's' : ''} bookmarked</p>
            </div>
            
            <div class="jobs-grid">
                ${jobsHtml}
            </div>
        </div>
        
        <div id="job-modal" class="modal">
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div id="modal-body"></div>
            </div>
        </div>
    `;
}

// ============================================
// OTHER PAGES
// ============================================

function createDigestPage() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const digestKey = `jobTrackerDigest_${today}`;
    const existingDigest = localStorage.getItem(digestKey);

    // Check if preferences are set
    if (!userPreferences) {
        return `
            <div class="digest-page">
                <div class="page-header">
                    <h1 class="page-header__title">Digest</h1>
                    <p class="page-header__subtitle">Your daily job summary, delivered at 9AM</p>
                </div>
                
                <div class="empty-state">
                    <p class="empty-state__message">Set preferences to generate a personalized digest</p>
                    <button class="btn btn--secondary" onclick="navigateTo('/settings')">Configure Preferences</button>
                </div>
            </div>
        `;
    }

    // If digest exists for today, load it
    if (existingDigest) {
        const digest = JSON.parse(existingDigest);
        return renderDigest(digest, today, true);
    }

    // Show generate button if no digest exists yet
    return `
        <div class="digest-page">
            <div class="page-header">
                <h1 class="page-header__title">Digest</h1>
                <p class="page-header__subtitle">Your daily job summary, delivered at 9AM</p>
            </div>
            
            <div class="digest-empty">
                <p class="digest-empty__message">No digest generated for today yet</p>
                <button class="btn btn--primary" onclick="generateDigest()">Generate Today's 9AM Digest (Simulated)</button>
                <p class="digest-note">Demo Mode: Daily 9AM trigger simulated manually</p>
            </div>
        </div>
    `;
}

function renderDigest(digest, date, isExisting) {
    if (!digest || digest.jobs.length === 0) {
        return `
            <div class="digest-page">
                <div class="page-header">
                    <h1 class="page-header__title">Digest</h1>
                    <p class="page-header__subtitle">Your daily job summary, delivered at 9AM</p>
                </div>
                
                <div class="empty-state">
                    <p class="empty-state__message">No matching roles today. Check again tomorrow.</p>
                    <button class="btn btn--secondary" onclick="navigateTo('/dashboard')">Browse All Jobs</button>
                </div>
            </div>
        `;
    }

    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const jobsHtml = digest.jobs.map((job, index) => `
        <div class="digest-job">
            <div class="digest-job__number">${index + 1}</div>
            <div class="digest-job__content">
                <div class="digest-job__header">
                    <h3 class="digest-job__title">${job.title}</h3>
                    ${job.matchScore !== undefined ? `<span class="match-badge ${getMatchScoreBadgeClass(job.matchScore)}">${job.matchScore}%</span>` : ''}
                </div>
                <p class="digest-job__company">${job.company}</p>
                <div class="digest-job__details">
                    <span>${job.location} • ${job.mode}</span>
                    <span>${job.experience}</span>
                    <span>${job.salaryRange}</span>
                </div>
                <button class="btn btn--primary btn--small" onclick="applyJob('${job.applyUrl}')">Apply Now</button>
            </div>
        </div>
    `).join('');

    return `
        <div class="digest-page">
            <div class="page-header">
                <h1 class="page-header__title">Digest</h1>
                <p class="page-header__subtitle">Your daily job summary, delivered at 9AM</p>
            </div>
            
            <div class="digest-container">
                <div class="digest-card">
                    <div class="digest-header">
                        <h2 class="digest-header__title">Top 10 Jobs For You — 9AM Digest</h2>
                        <p class="digest-header__date">${formattedDate}</p>
                    </div>
                    
                    <div class="digest-jobs">
                        ${jobsHtml}
                    </div>
                    
                    <div class="digest-footer">
                        <p class="digest-footer__text">This digest was generated based on your preferences.</p>
                        <p class="digest-note">Demo Mode: Daily 9AM trigger simulated manually</p>
                    </div>
                </div>
                
                ${statusHistory.length > 0 ? `
                    <div class="digest-card digest-card--status">
                        <div class="digest-header">
                            <h2 class="digest-header__title">Recent Status Updates</h2>
                        </div>
                        
                        <div class="status-updates">
                            ${statusHistory.slice(0, 10).map(entry => {
        const timeAgo = getTimeAgo(entry.timestamp);
        const statusClass = getStatusClass(entry.status);
        return `
                                    <div class="status-update">
                                        <div class="status-update__content">
                                            <h4 class="status-update__title">${entry.title}</h4>
                                            <p class="status-update__company">${entry.company}</p>
                                        </div>
                                        <div class="status-update__meta">
                                            <span class="status-badge ${statusClass}">${entry.status}</span>
                                            <span class="status-update__time">${timeAgo}</span>
                                        </div>
                                    </div>
                                `;
    }).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="digest-actions">
                    <button class="btn btn--secondary" onclick="copyDigestToClipboard()">Copy Digest to Clipboard</button>
                    <button class="btn btn--secondary" onclick="createEmailDraft()">Create Email Draft</button>
                    ${isExisting ? '<button class="btn btn--secondary" onclick="regenerateDigest()">Regenerate Digest</button>' : ''}
                </div>
            </div>
        </div>
    `;
}

function createSettingsPage() {
    // Load existing preferences or use defaults
    const prefs = userPreferences || {
        roleKeywords: [],
        preferredLocations: [],
        preferredMode: [],
        experienceLevel: '',
        skills: [],
        minMatchScore: 40
    };

    const roleKeywordsValue = Array.isArray(prefs.roleKeywords) ? prefs.roleKeywords.join(', ') : '';
    const preferredLocationsValue = Array.isArray(prefs.preferredLocations) ? prefs.preferredLocations.join(', ') : '';
    const skillsValue = Array.isArray(prefs.skills) ? prefs.skills.join(', ') : '';

    return `
        <div class="settings-page">
            <div class="page-header">
                <h1 class="page-header__title">Settings</h1>
                <p class="page-header__subtitle">Configure your job preferences</p>
            </div>
            
            <div class="settings-form">
                <div class="form-group">
                    <label class="form-label">Role Keywords</label>
                    <input type="text" id="roleKeywords" class="form-input" placeholder="e.g. Frontend Developer, React, UI Engineer" value="${roleKeywordsValue}">
                    <p class="form-hint">Enter job titles or keywords you're interested in (comma-separated)</p>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Preferred Locations</label>
                    <select id="preferredLocations" class="form-input" multiple size="5">
                        <option value="Bangalore" ${prefs.preferredLocations.includes('Bangalore') ? 'selected' : ''}>Bangalore</option>
                        <option value="Hyderabad" ${prefs.preferredLocations.includes('Hyderabad') ? 'selected' : ''}>Hyderabad</option>
                        <option value="Pune" ${prefs.preferredLocations.includes('Pune') ? 'selected' : ''}>Pune</option>
                        <option value="Chennai" ${prefs.preferredLocations.includes('Chennai') ? 'selected' : ''}>Chennai</option>
                        <option value="Mumbai" ${prefs.preferredLocations.includes('Mumbai') ? 'selected' : ''}>Mumbai</option>
                        <option value="Noida" ${prefs.preferredLocations.includes('Noida') ? 'selected' : ''}>Noida</option>
                        <option value="Gurgaon" ${prefs.preferredLocations.includes('Gurgaon') ? 'selected' : ''}>Gurgaon</option>
                        <option value="Mysore" ${prefs.preferredLocations.includes('Mysore') ? 'selected' : ''}>Mysore</option>
                    </select>
                    <p class="form-hint">Hold Ctrl/Cmd to select multiple locations</p>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Work Mode</label>
                    <div class="checkbox-group">
                        <label class="checkbox-option">
                            <input type="checkbox" name="work-mode" value="Remote" ${prefs.preferredMode.includes('Remote') ? 'checked' : ''}>
                            <span>Remote</span>
                        </label>
                        <label class="checkbox-option">
                            <input type="checkbox" name="work-mode" value="Hybrid" ${prefs.preferredMode.includes('Hybrid') ? 'checked' : ''}>
                            <span>Hybrid</span>
                        </label>
                        <label class="checkbox-option">
                            <input type="checkbox" name="work-mode" value="Onsite" ${prefs.preferredMode.includes('Onsite') ? 'checked' : ''}>
                            <span>Onsite</span>
                        </label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Experience Level</label>
                    <select id="experienceLevel" class="form-input">
                        <option value="">Select experience level</option>
                        <option value="Fresher" ${prefs.experienceLevel === 'Fresher' ? 'selected' : ''}>Fresher</option>
                        <option value="0-1" ${prefs.experienceLevel === '0-1' ? 'selected' : ''}>0-1 Years</option>
                        <option value="1-3" ${prefs.experienceLevel === '1-3' ? 'selected' : ''}>1-3 Years</option>
                        <option value="3-5" ${prefs.experienceLevel === '3-5' ? 'selected' : ''}>3-5 Years</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Skills</label>
                    <input type="text" id="skills" class="form-input" placeholder="e.g. React, JavaScript, Node.js, Python" value="${skillsValue}">
                    <p class="form-hint">Enter your skills (comma-separated)</p>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Minimum Match Score: <span id="minMatchScoreValue">${prefs.minMatchScore}%</span></label>
                    <input type="range" id="minMatchScore" class="form-slider" min="0" max="100" value="${prefs.minMatchScore}" oninput="document.getElementById('minMatchScoreValue').textContent = this.value + '%'">
                    <p class="form-hint">Only show jobs with match score above this threshold</p>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn--primary" onclick="savePreferences()">Save Preferences</button>
                    <button class="btn btn--secondary" onclick="resetPreferences()">Reset</button>
                </div>
            </div>
        </div>
    `;
}

function createTestChecklistPage() {
    const tests = [
        { id: 'test_prefs', label: 'Preferences persist after refresh', hint: 'Change settings, refresh page, verify settings remain.' },
        { id: 'test_score', label: 'Match score calculates correctly', hint: 'Verify job scores change based on updated preferences.' },
        { id: 'test_toggle', label: '"Show only matches" toggle works', hint: 'Enable toggle on dashboard, verify low score jobs disappear.' },
        { id: 'test_save', label: 'Save job persists after refresh', hint: 'Save a job, refresh, go to Saved Jobs page.' },
        { id: 'test_apply', label: 'Apply opens in new tab', hint: 'Click Apply, verify new tab opens with correct URL.' },
        { id: 'test_status', label: 'Status update persists after refresh', hint: 'Change job status, refresh, verify status remains.' },
        { id: 'test_filter', label: 'Status filter works correctly', hint: 'Filter by "Applied", verify only applied jobs show.' },
        { id: 'test_digest_gen', label: 'Digest generates top 10 by score', hint: 'Generate digest, verify high scoring jobs are listed first.' },
        { id: 'test_digest_persist', label: 'Digest persists for the day', hint: 'Refresh digest page, verify same digest loads without regenerating.' },
        { id: 'test_console', label: 'No console errors on main pages', hint: 'Check browser console (F12) while navigating.' }
    ];

    const passedCount = tests.filter(t => testChecklist[t.id]).length;
    const allPassed = passedCount === tests.length;

    // Ensure testChecklist is synced (optional cleanup could go here)

    const checklistHtml = tests.map(test => `
        <div class="checklist-item ${testChecklist[test.id] ? 'checklist-item--checked' : ''}">
            <label class="checkbox-label">
                <input type="checkbox" 
                       onchange="toggleTestItem('${test.id}', this.checked)" 
                       ${testChecklist[test.id] ? 'checked' : ''}>
                <span class="checklist-text">${test.label}</span>
            </label>
            ${test.hint ? `<div class="checklist-hint" title="${test.hint}">?</div>` : ''}
        </div>
    `).join('');

    return `
        <div class="test-page">
            <div class="page-header">
                <h1 class="page-header__title">Test Checklist</h1>
                <p class="page-header__subtitle">Verify all features before shipping</p>
            </div>
            
            <div class="test-container">
                <div class="test-summary ${allPassed ? 'test-summary--success' : ''}">
                    <h2 class="test-summary__title">Tests Passed: ${passedCount} / ${tests.length}</h2>
                    ${!allPassed ? '<p class="test-summary__warning">⚠️ Resolve all issues before shipping.</p>' : '<p class="test-summary__success">✅ All systems go! Ready to ship.</p>'}
                </div>
                
                <div class="checklist-container">
                    ${checklistHtml}
                </div>
                
                <div class="test-actions">
                    <button class="btn btn--secondary btn--small" onclick="resetTestStatus()">Reset Test Status</button>
                    ${allPassed ? `<button class="btn btn--primary" onclick="navigateTo('/jt/08-ship')">Proceed to Ship</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

function toggleTestItem(testId, isChecked) {
    testChecklist[testId] = isChecked;
    localStorage.setItem('jobTrackerTestChecklist', JSON.stringify(testChecklist));
    renderRoute('/jt/07-test');

    // Check if we need to unlock nav
    updateLockStatus();
}

function resetTestStatus() {
    if (confirm('Are you sure you want to reset all test progress?')) {
        testChecklist = {};
        localStorage.removeItem('jobTrackerTestChecklist');
        renderRoute('/jt/07-test');
        updateLockStatus();
    }
}

function updateLockStatus() {
    const navLinks = document.querySelectorAll('.nav__link');
    const tests = [
        'test_prefs', 'test_score', 'test_toggle', 'test_save', 'test_apply',
        'test_status', 'test_filter', 'test_digest_gen', 'test_digest_persist', 'test_console'
    ];
    const allPassed = tests.every(id => testChecklist[id]);

    navLinks.forEach(link => {
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes('/jt/08-ship')) {
            if (allPassed) {
                link.classList.remove('nav__link--locked');
                // Remove lock icon if present
                const lockIcon = link.querySelector('.lock-icon');
                if (lockIcon) lockIcon.remove();
            } else {
                if (!link.classList.contains('nav__link--locked')) {
                    link.classList.add('nav__link--locked');
                }
                // Add lock icon if not present
                if (!link.querySelector('.lock-icon')) {
                    const icon = document.createElement('span');
                    icon.className = 'lock-icon';
                    icon.textContent = '🔒';
                    icon.style.marginLeft = 'auto';
                    icon.style.fontSize = '12px';
                    link.appendChild(icon);
                }
            }
        }
    });
}


function createProofPage() {
    const steps = [
        { id: 1, label: 'Job Dashboard Interface', status: 'Completed' },
        { id: 2, label: 'Job Cards Rendering', status: 'Completed' },
        { id: 3, label: 'Filtering System', status: 'Completed' },
        { id: 4, label: 'Global State Management', status: 'Completed' },
        { id: 5, label: 'Intelligent Matching Engine', status: 'Completed' },
        { id: 6, label: 'Digest Generation System', status: 'Completed' },
        { id: 7, label: 'Status Tracking System', status: 'Completed' },
        { id: 8, label: 'Built-in Test Checklist', status: 'Completed' }
    ];

    const hasLinks = proofArtifacts.lovableLink && proofArtifacts.githubLink && proofArtifacts.deployedLink;
    const allTestsPassed = Object.keys(testChecklist).length === 10 && Object.values(testChecklist).every(v => v);
    const canShip = hasLinks && allTestsPassed;

    let statusBadgeClass = 'status-badge--not-started';
    let statusText = 'Not Started';

    if (hasLinks || allTestsPassed) {
        statusBadgeClass = 'status-badge--in-progress';
        statusText = 'In Progress';
    }

    if (canShip) {
        statusBadgeClass = 'status-badge--shipped';
        statusText = 'Shipped';
    }

    const submissionText = generateSubmissionText();

    return `
        <div class="proof-page">
            <div class="page-header">
                <h1 class="page-header__title">Proof & Submission</h1>
                <p class="page-header__subtitle">Final validation for Project 1</p>
            </div>
            
            <div class="proof-container">
                <!-- Section A: Step Completion Summary -->
                <div class="proof-section">
                    <h2 class="proof-section__title">A) Step Completion Summary</h2>
                    <div class="step-list">
                        ${steps.map(step => `
                            <div class="step-item">
                                <span class="step-status-icon">✓</span>
                                <span class="step-label">${step.label}</span>
                                <span class="step-status">${step.status}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Section B: Artifact Collection -->
                <div class="proof-section">
                    <h2 class="proof-section__title">B) Artifact Collection</h2>
                    <div class="artifact-form">
                        <div class="form-group">
                            <label class="form-label">Lovable Project Link</label>
                            <input type="url" class="form-input artifact-input" 
                                   placeholder="https://lovable.dev/..."
                                   value="${proofArtifacts.lovableLink}"
                                   onchange="saveProofArtifacts('lovableLink', this.value)">
                        </div>
                        <div class="form-group">
                            <label class="form-label">GitHub Repository Link</label>
                            <input type="url" class="form-input artifact-input" 
                                   placeholder="https://github.com/..."
                                   value="${proofArtifacts.githubLink}"
                                   onchange="saveProofArtifacts('githubLink', this.value)">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Deployed URL</label>
                            <input type="url" class="form-input artifact-input" 
                                   placeholder="https://..."
                                   value="${proofArtifacts.deployedLink}"
                                   onchange="saveProofArtifacts('deployedLink', this.value)">
                        </div>
                    </div>
                </div>

                <!-- Shipping Status -->
                <div class="proof-section">
                    <div class="shipping-status">
                        <h2 class="proof-section__title" style="margin-bottom:0">Project Status</h2>
                        <span class="status-badge ${statusBadgeClass}">${statusText}</span>
                    </div>
                    
                    ${!allTestsPassed ? `<p class="status-warning">⚠️ Complete all test checklist items to ship.</p>` : ''}
                    ${!hasLinks ? `<p class="status-warning">⚠️ Provide all 3 artifact links to ship.</p>` : ''}
                    
                    ${canShip ? `
                        <div class="completion-message">
                            <span class="completion-icon">✨</span>
                            Project 1 Shipped Successfully.
                        </div>
                    ` : ''}
                </div>

                <!-- Final Submission Export -->
                <div class="proof-section">
                    <h2 class="proof-section__title">Final Submission Export</h2>
                    <div class="submission-area">
                        <textarea class="submission-text" readonly>${submissionText}</textarea>
                        <button class="btn btn--primary" onclick="copySubmissionText()">Copy Final Submission</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function saveProofArtifacts(key, value) {
    proofArtifacts[key] = value;
    localStorage.setItem('jobTrackerProofArtifacts', JSON.stringify(proofArtifacts));
    renderRoute('/proof');
}

function generateSubmissionText() {
    return `Job Notification Tracker — Final Submission

Lovable Project:
${proofArtifacts.lovableLink || '[Pending]'}

GitHub Repository:
${proofArtifacts.githubLink || '[Pending]'}

Live Deployment:
${proofArtifacts.deployedLink || '[Pending]'}

Core Features:
- Intelligent match scoring
- Daily digest simulation
- Status tracking
- Test checklist enforced`;
}

function copySubmissionText() {
    const textarea = document.querySelector('.submission-text');
    textarea.select();
    document.execCommand('copy');
    alert('Submission text copied to clipboard.');
}

// ============================================
// PREFERENCE FUNCTIONS
// ============================================

function savePreferences() {
    const roleKeywords = document.getElementById('roleKeywords').value
        .split(',')
        .map(k => k.trim())
        .filter(k => k);

    const preferredLocations = Array.from(document.getElementById('preferredLocations').selectedOptions)
        .map(option => option.value);

    const preferredMode = Array.from(document.querySelectorAll('input[name="work-mode"]:checked'))
        .map(checkbox => checkbox.value);

    const experienceLevel = document.getElementById('experienceLevel').value;

    const skills = document.getElementById('skills').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s);

    const minMatchScore = parseInt(document.getElementById('minMatchScore').value);

    const preferences = {
        roleKeywords,
        preferredLocations,
        preferredMode,
        experienceLevel,
        skills,
        minMatchScore
    };

    localStorage.setItem('jobTrackerPreferences', JSON.stringify(preferences));
    userPreferences = preferences;

    // Recalculate match scores
    allJobs = allJobs.map(job => ({
        ...job,
        matchScore: calculateMatchScore(job, userPreferences)
    }));

    filteredJobs = [...allJobs];

    // Show success message and navigate to dashboard
    alert('Preferences saved successfully!');
    navigateTo('/dashboard');
}

function resetPreferences() {
    if (confirm('Are you sure you want to reset all preferences?')) {
        localStorage.removeItem('jobTrackerPreferences');
        userPreferences = null;

        // Remove match scores
        allJobs = allJobs.map(job => {
            const { matchScore, ...jobWithoutScore } = job;
            return jobWithoutScore;
        });

        filteredJobs = [...allJobs];
        renderRoute('/settings');
    }
}

function toggleShowOnlyMatches(checked) {
    showOnlyMatches = checked;
    applyFilters();
    renderRoute(window.location.pathname);
}

// ============================================
// FILTER FUNCTIONS
// ============================================

function handleFilterChange(filterType, value) {
    currentFilters[filterType] = value;
    applyFilters();
    renderRoute(window.location.pathname);
}

function applyFilters() {
    filteredJobs = allJobs.filter(job => {
        // Match score threshold filter (if preferences set and toggle enabled)
        if (userPreferences && showOnlyMatches) {
            if (!job.matchScore || job.matchScore < userPreferences.minMatchScore) {
                return false;
            }
        }

        // Keyword filter
        if (currentFilters.keyword) {
            const keyword = currentFilters.keyword.toLowerCase();
            const matchesTitle = job.title.toLowerCase().includes(keyword);
            const matchesCompany = job.company.toLowerCase().includes(keyword);
            if (!matchesTitle && !matchesCompany) return false;
        }

        // Location filter
        if (currentFilters.location !== 'all' && job.location !== currentFilters.location) {
            return false;
        }

        // Mode filter
        if (currentFilters.mode !== 'all' && job.mode !== currentFilters.mode) {
            return false;
        }

        // Experience filter
        if (currentFilters.experience !== 'all' && job.experience !== currentFilters.experience) {
            return false;
        }

        // Source filter
        if (currentFilters.source !== 'all' && job.source !== currentFilters.source) {
            return false;
        }

        // Status filter
        if (currentFilters.status !== 'all') {
            const jobCurrentStatus = jobStatus[job.id] || 'Not Applied';
            if (jobCurrentStatus !== currentFilters.status) {
                return false;
            }
        }

        return true;
    });

    // Apply sorting
    if (currentFilters.sort === 'latest') {
        filteredJobs.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
    } else if (currentFilters.sort === 'oldest') {
        filteredJobs.sort((a, b) => b.postedDaysAgo - a.postedDaysAgo);
    } else if (currentFilters.sort === 'matchScore') {
        filteredJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else if (currentFilters.sort === 'salary') {
        filteredJobs.sort((a, b) => {
            const salaryA = extractSalaryNumber(a.salaryRange);
            const salaryB = extractSalaryNumber(b.salaryRange);
            return salaryB - salaryA;
        });
    }
}

function extractSalaryNumber(salaryRange) {
    // Extract first number from salary range for sorting
    const match = salaryRange.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

// ============================================
// JOB ACTIONS
// ============================================

function viewJob(jobId) {
    const job = allJobs.find(j => j.id === jobId);
    if (!job) return;

    const modal = document.getElementById('job-modal');
    const modalBody = document.getElementById('modal-body');

    const matchScoreBadge = userPreferences && job.matchScore !== undefined ? `
        <span class="match-badge ${getMatchScoreBadgeClass(job.matchScore)}">${job.matchScore}% Match</span>
    ` : '';

    modalBody.innerHTML = `
        <div class="modal-job">
            <h2 class="modal-job__title">${job.title}</h2>
            <p class="modal-job__company">${job.company}</p>
            
            <div class="modal-job__meta">
                <span>${job.location} • ${job.mode}</span>
                <span>${job.experience}</span>
                <span class="source-badge source-badge--${job.source.toLowerCase()}">${job.source}</span>
                ${matchScoreBadge}
            </div>
            
            <div class="modal-job__salary">${job.salaryRange}</div>
            
            <h3 class="modal-section-title">Description</h3>
            <p class="modal-job__description">${job.description}</p>
            
            <h3 class="modal-section-title">Required Skills</h3>
            <div class="skills-list">
                ${job.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
            
            <div class="modal-actions">
                <button class="btn btn--primary" onclick="applyJob('${job.applyUrl}')">Apply Now</button>
                <button class="btn btn--secondary" onclick="toggleSaveJob('${job.id}'); closeModal();">
                    ${savedJobIds.includes(job.id) ? 'Unsave' : 'Save Job'}
                </button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Close modal handlers
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.onclick = closeModal;

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

function closeModal() {
    const modal = document.getElementById('job-modal');
    if (modal) modal.style.display = 'none';
}

function toggleSaveJob(jobId) {
    const index = savedJobIds.indexOf(jobId);

    if (index > -1) {
        savedJobIds.splice(index, 1);
    } else {
        savedJobIds.push(jobId);
    }

    localStorage.setItem('savedJobs', JSON.stringify(savedJobIds));
    renderRoute(window.location.pathname);
}

function applyJob(url) {
    window.open(url, '_blank');
}

// ============================================
// STATUS MANAGEMENT FUNCTIONS
// ============================================

function changeJobStatus(jobId, newStatus) {
    // Update status
    jobStatus[jobId] = newStatus;

    // Save to localStorage
    localStorage.setItem('jobTrackerStatus', JSON.stringify(jobStatus));

    // Add to history if status is Applied, Rejected, or Selected
    if (['Applied', 'Rejected', 'Selected'].includes(newStatus)) {
        const job = allJobs.find(j => j.id === jobId);
        if (job) {
            const historyEntry = {
                jobId: jobId,
                title: job.title,
                company: job.company,
                status: newStatus,
                timestamp: new Date().toISOString()
            };

            // Add to beginning of array
            statusHistory.unshift(historyEntry);

            // Keep only last 20 entries
            if (statusHistory.length > 20) {
                statusHistory = statusHistory.slice(0, 20);
            }

            // Save to localStorage
            localStorage.setItem('jobTrackerStatusHistory', JSON.stringify(statusHistory));

            // Show toast notification
            showToast(`Status updated: ${newStatus}`);
        }
    }

    // Re-render current page to update UI
    const currentPath = window.location.pathname === '/dashboard' ? '/' : window.location.pathname;
    renderRoute(currentPath);
}

function getStatusClass(status) {
    switch (status) {
        case 'Not Applied':
            return 'status-btn--neutral';
        case 'Applied':
            return 'status-btn--blue';
        case 'Rejected':
            return 'status-btn--red';
        case 'Selected':
            return 'status-btn--green';
        default:
            return 'status-btn--neutral';
    }
}

function showToast(message) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    // Add to body
    document.body.appendChild(toast);

    // Show toast with animation
    setTimeout(() => {
        toast.classList.add('toast--show');
    }, 10);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        toast.classList.remove('toast--show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================
// DIGEST FUNCTIONS
// ============================================

function generateDigest() {
    if (!userPreferences) {
        alert('Please set your preferences first.');
        navigateTo('/settings');
        return;
    }

    // Get jobs with match scores
    const jobsWithScores = allJobs.filter(job => job.matchScore !== undefined && job.matchScore > 0);

    if (jobsWithScores.length === 0) {
        alert('No matching jobs found. Try adjusting your preferences.');
        return;
    }

    // Sort by matchScore descending, then postedDaysAgo ascending
    const sortedJobs = [...jobsWithScores].sort((a, b) => {
        if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
        }
        return a.postedDaysAgo - b.postedDaysAgo;
    });

    // Take top 10
    const top10Jobs = sortedJobs.slice(0, 10);

    // Create digest object
    const today = new Date().toISOString().split('T')[0];
    const digest = {
        date: today,
        generatedAt: new Date().toISOString(),
        jobs: top10Jobs
    };

    // Save to localStorage
    const digestKey = `jobTrackerDigest_${today}`;
    localStorage.setItem(digestKey, JSON.stringify(digest));

    // Re-render page
    renderRoute('/digest');
}

function regenerateDigest() {
    const today = new Date().toISOString().split('T')[0];
    const digestKey = `jobTrackerDigest_${today}`;
    localStorage.removeItem(digestKey);
    generateDigest();
}

function copyDigestToClipboard() {
    const today = new Date().toISOString().split('T')[0];
    const digestKey = `jobTrackerDigest_${today}`;
    const existingDigest = localStorage.getItem(digestKey);

    if (!existingDigest) {
        alert('No digest to copy.');
        return;
    }

    const digest = JSON.parse(existingDigest);
    const formattedDate = new Date(digest.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Create plain text version
    let text = `TOP 10 JOBS FOR YOU — 9AM DIGEST\n`;
    text += `${formattedDate}\n`;
    text += `\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    digest.jobs.forEach((job, index) => {
        text += `${index + 1}. ${job.title}\n`;
        text += `   Company: ${job.company}\n`;
        text += `   Location: ${job.location} • ${job.mode}\n`;
        text += `   Experience: ${job.experience}\n`;
        text += `   Salary: ${job.salaryRange}\n`;
        if (job.matchScore !== undefined) {
            text += `   Match Score: ${job.matchScore}%\n`;
        }
        text += `   Apply: ${job.applyUrl}\n`;
        text += `\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `This digest was generated based on your preferences.\n`;
    text += `Demo Mode: Daily 9AM trigger simulated manually\n`;

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        alert('Digest copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard. Please try again.');
    });
}

function createEmailDraft() {
    const today = new Date().toISOString().split('T')[0];
    const digestKey = `jobTrackerDigest_${today}`;
    const existingDigest = localStorage.getItem(digestKey);

    if (!existingDigest) {
        alert('No digest to email.');
        return;
    }

    const digest = JSON.parse(existingDigest);
    const formattedDate = new Date(digest.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Create email body
    let body = `TOP 10 JOBS FOR YOU — 9AM DIGEST%0D%0A`;
    body += `${formattedDate}%0D%0A`;
    body += `%0D%0A`;
    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%0D%0A%0D%0A`;

    digest.jobs.forEach((job, index) => {
        body += `${index + 1}. ${job.title}%0D%0A`;
        body += `   Company: ${job.company}%0D%0A`;
        body += `   Location: ${job.location} • ${job.mode}%0D%0A`;
        body += `   Experience: ${job.experience}%0D%0A`;
        body += `   Salary: ${job.salaryRange}%0D%0A`;
        if (job.matchScore !== undefined) {
            body += `   Match Score: ${job.matchScore}%%0D%0A`;
        }
        body += `   Apply: ${job.applyUrl}%0D%0A`;
        body += `%0D%0A`;
    });

    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%0D%0A`;
    body += `This digest was generated based on your preferences.%0D%0A`;
    body += `Demo Mode: Daily 9AM trigger simulated manually%0D%0A`;

    const subject = 'My 9AM Job Digest';
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`;

    window.location.href = mailtoLink;
}

// ============================================
// ROUTER FUNCTIONS
// ============================================

function navigateTo(path) {
    // Check for ship lock
    if (path === '/jt/08-ship' && !checkShipAllowed()) {
        alert('⚠️ functionality locked! Complete the test checklist first.');
        return;
    }

    const normalizedPath = path === '/dashboard' ? '/' : path;
    window.history.pushState({}, '', normalizedPath);
    renderRoute(normalizedPath);
    updateActiveLink(normalizedPath);
    closeMobileMenu();
}

function checkShipAllowed() {
    const tests = [
        'test_prefs', 'test_score', 'test_toggle', 'test_save', 'test_apply',
        'test_status', 'test_filter', 'test_digest_gen', 'test_digest_persist', 'test_console'
    ];
    return tests.every(id => testChecklist[id]);
}

function renderRoute(path) {
    const route = routes[path] || routes['/'];
    const contentArea = document.getElementById('app-content');

    if (contentArea) {
        contentArea.innerHTML = route.render();
        document.title = `${route.title} - Job Notification Tracker`;
    }
}

function updateActiveLink(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    document.querySelectorAll(`.nav-link[data-route="${path}"]`).forEach(link => {
        link.classList.add('active');
    });

    if (path === '/') {
        document.querySelectorAll('.nav-link[data-route="/dashboard"]').forEach(link => {
            link.classList.add('active');
        });
    }
}

function closeMobileMenu() {
    const mobileNav = document.querySelector('.mobile-nav');
    const menuToggle = document.querySelector('.mobile-menu-toggle');

    if (mobileNav) mobileNav.classList.remove('active');
    if (menuToggle) menuToggle.classList.remove('active');
}

function initRouter() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (link) {
            e.preventDefault();
            const path = link.getAttribute('data-route');
            navigateTo(path);
        }
    });

    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNav = document.querySelector('.mobile-nav');

    if (menuToggle && mobileNav) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mobileNav.classList.toggle('active');
        });
    }

    window.addEventListener('popstate', () => {
        renderRoute(window.location.pathname);
        updateActiveLink(window.location.pathname);
    });

    const initialPath = window.location.pathname === '/dashboard' ? '/' : window.location.pathname;
    renderRoute(initialPath);
    updateActiveLink(initialPath);
}
