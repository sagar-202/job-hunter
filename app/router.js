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
let currentFilters = {
    keyword: '',
    location: 'all',
    mode: 'all',
    experience: 'all',
    source: 'all',
    sort: 'latest'
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Load jobs data
    allJobs = typeof jobsData !== 'undefined' ? jobsData : [];

    // Load saved jobs from localStorage
    const saved = localStorage.getItem('savedJobs');
    savedJobIds = saved ? JSON.parse(saved) : [];

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
    return `
        <div class="digest-page">
            <div class="page-header">
                <h1 class="page-header__title">Digest</h1>
                <p class="page-header__subtitle">Your daily job summary, delivered at 9AM</p>
            </div>
            
            <div class="empty-state">
                <p class="empty-state__message">No digest available yet</p>
                <p class="empty-state__hint">Your first digest will be generated once you configure your preferences and we have matching jobs.</p>
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
                    <input type="text" id="roleKeywords" class="form-input" placeholder="e.g. Frontend Developer, React Engineer, SDE" value="${roleKeywordsValue}">
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

function createProofPage() {
    return `
        <div class="proof-page">
            <div class="page-header">
                <h1 class="page-header__title">Proof</h1>
                <p class="page-header__subtitle">Artifact collection and verification</p>
            </div>
            
            <div class="proof-placeholder">
                <p class="proof-placeholder__message">This section will collect proof artifacts as you build the application.</p>
                
                <div class="proof-checklist">
                    <label class="proof-item">
                        <input type="checkbox" class="proof-checkbox" checked>
                        <span>Settings configured</span>
                    </label>
                    <label class="proof-item">
                        <input type="checkbox" class="proof-checkbox" checked>
                        <span>Jobs loaded</span>
                    </label>
                    <label class="proof-item">
                        <input type="checkbox" class="proof-checkbox" ${userPreferences ? 'checked' : ''}>
                        <span>Matching working</span>
                    </label>
                    <label class="proof-item">
                        <input type="checkbox" class="proof-checkbox">
                        <span>Digest generated</span>
                    </label>
                </div>
            </div>
        </div>
    `;
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
// ROUTER FUNCTIONS
// ============================================

function navigateTo(path) {
    const normalizedPath = path === '/dashboard' ? '/' : path;
    window.history.pushState({}, '', normalizedPath);
    renderRoute(normalizedPath);
    updateActiveLink(normalizedPath);
    closeMobileMenu();
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
