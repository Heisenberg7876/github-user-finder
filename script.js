let currentPage = 1;
const reposPerPage = 9;
let allRepos = [];
let currentUsername = '';
let repoChart = null;
let heatmapChart = null;

document.getElementById('search-btn').addEventListener('click', () => searchUser(1));
document.getElementById('search').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchUser(1);
});
document.getElementById('clear-btn').addEventListener('click', clearSearch);
document.getElementById('share-btn').addEventListener('click', shareProfile);
document.getElementById('share-twitter').addEventListener('click', shareOnTwitter);
document.getElementById('share-linkedin').addEventListener('click', shareOnLinkedIn);
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('load-more-btn').addEventListener('click', loadMoreRepos);
document.getElementById('filter-language').addEventListener('change', filterRepos);
document.getElementById('sort-repos').addEventListener('change', sortRepos);
document.getElementById('search').addEventListener('focus', showSearchHistory);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('download-stats-card').addEventListener('click', downloadStatsCard);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Initialize theme
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.body.classList.add('dark-mode');
} else {
  document.body.classList.add('light-mode');
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  document.body.classList.toggle('light-mode');
  const icon = document.getElementById('theme-toggle').querySelector('i');
  if (document.body.classList.contains('dark-mode')) {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  } else {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  }
  updateChartColors();
}

function saveSearch(username) {
  let searches = JSON.parse(localStorage.getItem('githubSearches') || '[]');
  if (!searches.includes(username)) {
    searches.unshift(username);
    searches = searches.slice(0, 5);
    localStorage.setItem('githubSearches', JSON.stringify(searches));
  }
}

function showSearchHistory() {
  const searchHistory = document.getElementById('search-history');
  const searches = JSON.parse(localStorage.getItem('githubSearches') || '[]');
  if (searches.length === 0) {
    searchHistory.classList.add('hidden');
    return;
  }
  searchHistory.innerHTML = searches.map(search => `
    <div class="search-history-item" data-username="${search}">${search}</div>
  `).join('');
  searchHistory.classList.remove('hidden');
  document.querySelectorAll('.search-history-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('search').value = item.dataset.username;
      searchUser(1);
      searchHistory.classList.add('hidden');
    });
  });
}

async function searchUser(page) {
  const username = document.getElementById('search').value.trim();
  const profileContainer = document.getElementById('profile-container');
  const errorContainer = document.getElementById('error-container');
  const reposContainer = document.getElementById('repos-container');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const filterLanguage = document.getElementById('filter-language');
  const sortRepos = document.getElementById('sort-repos');

  if (!username) return;

  saveSearch(username);
  currentUsername = username;
  currentPage = page;

  profileContainer.classList.add('hidden');
  errorContainer.classList.add('hidden');
  reposContainer.innerHTML = '<div class="loading-repos"><i class="fas fa-spinner fa-spin"></i> Loading repositories...</div>';
  loadMoreBtn.classList.add('hidden');
  filterLanguage.innerHTML = '<option value="">All Languages</option>';
  sortRepos.value = 'updated';
  document.getElementById('search-history').classList.add('hidden');
  if (repoChart) repoChart.destroy();
  if (heatmapChart) heatmapChart.destroy();

  try {
    const userRes = await fetch(`https://api.github.com/users/${username}`);
    if (!userRes.ok) throw new Error('User not found');
    const user = await userRes.json();

    document.getElementById('avatar').src = user.avatar_url;
    document.getElementById('name').textContent = user.name || user.login;
    document.getElementById('username').textContent = `@${user.login}`;
    document.getElementById('bio').textContent = user.bio || 'No bio available';
    document.getElementById('location').textContent = user.location || 'Not specified';
    document.getElementById('joined-date').textContent = new Date(user.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    document.getElementById('followers').textContent = user.followers;
    document.getElementById('following').textContent = user.following;
    document.getElementById('repos').textContent = user.public_repos;
    document.getElementById('company').textContent = user.company || 'Not specified';
    document.getElementById('blog').textContent = user.blog || 'No website';
    document.getElementById('blog').href = user.blog || '#';
    document.getElementById('twitter').textContent = user.twitter_username || 'No Twitter';
    document.getElementById('twitter').href = user.twitter_username ? `https://twitter.com/${user.twitter_username}` : '#';
    document.getElementById('profile-link').href = user.html_url;

    profileContainer.classList.remove('hidden');

    const reposRes = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100`);
    if (!reposRes.ok) throw new Error('Error fetching repos');
    allRepos = await reposRes.json();

    const languages = [...new Set(allRepos.map(repo => repo.language).filter(lang => lang))];
    filterLanguage.innerHTML = '<option value="">All Languages</option>' + languages.map(lang => `
      <option value="${lang}">${lang}</option>
    `).join('');

    displayRepos(allRepos, page);
    generateStatsCard(user);
    generateActivityHeatmap(username);
  } catch (error) {
    errorContainer.classList.remove('hidden');
    errorContainer.querySelector('p').textContent = `<i class="fas fa-exclamation-circle"></i> ${error.message || 'An error occurred'}`;
    reposContainer.innerHTML = '';
  }
}

function sortRepos() {
  const sortBy = document.getElementById('sort-repos').value;
  if (sortBy === 'stars') {
    allRepos.sort((a, b) => b.stargazers_count - a.stargazers_count);
  } else if (sortBy === 'forks') {
    allRepos.sort((a, b) => b.forks_count - a.forks_count);
  } else {
    allRepos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }
  currentPage = 1;
  displayRepos(allRepos, currentPage);
}

function displayRepos(repos, page) {
  const reposContainer = document.getElementById('repos-container');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const filterLanguage = document.getElementById('filter-language').value;

  const filteredRepos = filterLanguage ? repos.filter(repo => repo.language === filterLanguage) : repos;

  const start = (page - 1) * reposPerPage;
  const end = start + reposPerPage;
  const paginatedRepos = filteredRepos.slice(start, end);

  reposContainer.innerHTML = '';

  if (paginatedRepos.length === 0) {
    reposContainer.innerHTML = '<p class="no-repos">No repositories found.</p>';
  } else {
    paginatedRepos.forEach((repo, index) => {
      const repoDiv = document.createElement('div');
      repoDiv.classList.add('repo');
      repoDiv.style.animationDelay = `${index * 0.1}s`;
      repoDiv.innerHTML = `
        <h4><a href="${repo.html_url}" target="_blank">${repo.name}</a></h4>
        <p>${repo.description || 'No description'}</p>
        <div class="repo-stats">
          <span><i class="fas fa-star"></i>${repo.stargazers_count}</span>
          <span><i class="fas fa-code-branch"></i>${repo.forks_count}</span>
          <span><i class="fas fa-code"></i>${repo.language || 'N/A'}</span>
        </div>
      `;
      repoDiv.addEventListener('click', () => showRepoModal(repo));
      reposContainer.appendChild(repoDiv);
    });

    if (filteredRepos.length > end) {
      loadMoreBtn.classList.remove('hidden');
    } else {
      loadMoreBtn.classList.add('hidden');
    }

    updateRepoChart(paginatedRepos);
  }
}

function updateRepoChart(repos) {
  const ctx = document.getElementById('repo-stats-chart').getContext('2d');
  const isDarkMode = document.body.classList.contains('dark-mode');
  const textColor = isDarkMode ? '#f3f4f6' : '#111827';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';

  if (repoChart) repoChart.destroy();

  repoChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: repos.map(repo => repo.name),
      datasets: [
        {
          label: 'Stars',
          data: repos.map(repo => repo.stargazers_count),
          backgroundColor: 'rgba(37, 99, 235, 0.7)',
          borderColor: '#2563eb',
          borderWidth: 1
        },
        {
          label: 'Forks',
          data: repos.map(repo => repo.forks_count),
          backgroundColor: 'rgba(96, 165, 250, 0.7)',
          borderColor: '#60a5fa',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: textColor,
            font: { size: 14, weight: '600' }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 12 } },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor, font: { size: 12 } },
          grid: { color: gridColor }
        }
      }
    }
  });
}

async function generateActivityHeatmap(username) {
  const ctx = document.getElementById('activity-heatmap').getContext('2d');
  const isDarkMode = document.body.classList.contains('dark-mode');
  const textColor = isDarkMode ? '#f3f4f6' : '#111827';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';

  if (heatmapChart) heatmapChart.destroy();

  try {
    const eventsRes = await fetch(`https://api.github.com/users/${username}/events?per_page=100`);
    if (!eventsRes.ok) throw new Error('Error fetching events');
    const events = await eventsRes.json();

    const commitsByMonth = Array(12).fill(0);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    events.forEach(event => {
      if (event.type === 'PushEvent') {
        const eventDate = new Date(event.created_at);
        if (eventDate >= oneYearAgo) {
          const month = eventDate.getMonth();
          commitsByMonth[month] += event.payload.commits.length;
        }
      }
    });

    heatmapChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Commits per Month',
          data: commitsByMonth,
          backgroundColor: commitsByMonth.map(count => `rgba(37, 99, 235, ${Math.min(0.2 + count * 0.05, 0.9)})`),
          borderColor: '#2563eb',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: textColor,
              font: { size: 14, weight: '600' }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { size: 12 } },
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: textColor, font: { size: 12 } },
            grid: { color: gridColor }
          }
        }
      }
    });
  } catch (error) {
    document.getElementById('activity-heatmap').parentElement.innerHTML = '<p>Error loading activity heatmap.</p>';
  }
}

function generateStatsCard(user) {
  const canvas = document.getElementById('stats-card-canvas');
  const ctx = canvas.getContext('2d');
  const isDarkMode = document.body.classList.contains('dark-mode');
  canvas.width = 400;
  canvas.height = 200;

  ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = isDarkMode ? '#f3f4f6' : '#111827';
  ctx.font = 'bold 24px Poppins';
  ctx.fillText(user.name || user.login, 20, 40);

  ctx.font = '16px Poppins';
  ctx.fillText(`@${user.login}`, 20, 65);

  ctx.font = '14px Poppins';
  ctx.fillText(`Followers: ${user.followers}`, 20, 100);
  ctx.fillText(`Following: ${user.following}`, 20, 120);
  ctx.fillText(`Repositories: ${user.public_repos}`, 20, 140);
  ctx.fillText(`Joined: ${new Date(user.created_at).toLocaleDateString('en-US')}`, 20, 160);

  if (user.avatar_url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = user.avatar_url;
    img.onload = () => {
      ctx.drawImage(img, 300, 20, 80, 80);
    };
  }
}

function downloadStatsCard() {
  const canvas = document.getElementById('stats-card-canvas');
  const link = document.createElement('a');
  link.download = `${currentUsername}-github-stats.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function updateChartColors() {
  if (repoChart) {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const textColor = isDarkMode ? '#f3f4f6' : '#111827';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
    repoChart.options.plugins.legend.labels.color = textColor;
    repoChart.options.scales.x.ticks.color = textColor;
    repoChart.options.scales.x.grid.color = gridColor;
    repoChart.options.scales.y.ticks.color = textColor;
    repoChart.options.scales.y.grid.color = gridColor;
    repoChart.update();
  }
  if (heatmapChart) {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const textColor = isDarkMode ? '#f3f4f6' : '#111827';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
    heatmapChart.options.plugins.legend.labels.color = textColor;
    heatmapChart.options.scales.x.ticks.color = textColor;
    heatmapChart.options.scales.x.grid.color = gridColor;
    heatmapChart.options.scales.y.ticks.color = textColor;
    heatmapChart.options.scales.y.grid.color = gridColor;
    heatmapChart.update();
  }
}

async function showRepoModal(repo) {
  const modal = document.getElementById('repo-modal');
  document.getElementById('modal-repo-name').textContent = repo.name;
  document.getElementById('modal-repo-description').textContent = repo.description || 'No description';
  document.getElementById('modal-repo-stars').textContent = repo.stargazers_count;
  document.getElementById('modal-repo-forks').textContent = repo.forks_count;
  document.getElementById('modal-repo-language').textContent = repo.language || 'N/A';
  document.getElementById('modal-repo-created').textContent = new Date(repo.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  document.getElementById('modal-repo-issues').textContent = repo.open_issues_count;
  document.getElementById('modal-repo-link').href = repo.html_url;

  try {
    const commitsRes = await fetch(`${repo.url}/commits?per_page=1`);
    if (commitsRes.ok) {
      const commits = await commitsRes.json();
      document.getElementById('modal-repo-last-commit').textContent = commits.length > 0
        ? new Date(commits[0].commit.author.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'No commits';
    } else {
      document.getElementById('modal-repo-last-commit').textContent = 'Unable to fetch';
    }
  } catch {
    document.getElementById('modal-repo-last-commit').textContent = 'Unable to fetch';
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('repo-modal').classList.add('hidden');
}

function filterRepos() {
  currentPage = 1;
  sortRepos();
}

function clearSearch() {
  document.getElementById('search').value = '';
  document.getElementById('profile-container').classList.add('hidden');
  document.getElementById('error-container').classList.add('hidden');
  document.getElementById('repos-container').innerHTML = '';
  document.getElementById('load-more-btn').classList.add('hidden');
  document.getElementById('filter-language').innerHTML = '<option value="">All Languages</option>';
  document.getElementById('sort-repos').value = 'updated';
  document.getElementById('search-history').classList.add('hidden');
  if (repoChart) repoChart.destroy();
  if (heatmapChart) heatmapChart.destroy();
  allRepos = [];
  currentUsername = '';
}

function shareProfile() {
  const username = document.getElementById('username').textContent.slice(1);
  const profileUrl = `https://github.com/${username}`;
  if (navigator.share) {
    navigator.share({
      title: `${username}'s GitHub Profile`,
      text: `Check out ${username}'s GitHub profile!`,
      url: profileUrl
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(profileUrl).then(() => {
      alert('Profile URL copied to clipboard!');
    }).catch(console.error);
  }
}

function shareOnTwitter() {
  const username = document.getElementById('username').textContent.slice(1);
  const profileUrl = `https://github.com/${username}`;
  const text = encodeURIComponent(`Check out ${username}'s GitHub profile! ${profileUrl}`);
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

function shareOnLinkedIn() {
  const username = document.getElementById('username').textContent.slice(1);
  const profileUrl = `https://github.com/${username}`;
  const text = encodeURIComponent(`Check out ${username}'s GitHub profile: ${profileUrl}`);
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}&title=${text}`, '_blank');
}

function loadMoreRepos() {
  searchUser(currentPage + 1);
}