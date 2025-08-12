// Global variables and initialization
let inventoryData = {
  inward: [],
  outward: [],
  returns: [],
  expiry: []
};

let charts = {};
let currentTheme = localStorage.getItem('theme') || 'light';
let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
let currentUser = localStorage.getItem('currentUser') || 'Admin';

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

function initializeApp() {
  // Load saved data from localStorage
  const savedData = localStorage.getItem('inventoryData');
  if (savedData) {
    inventoryData = JSON.parse(savedData);
  }

  if (!isLoggedIn) {
    showLoginModal();
    return;
  }
  
  setDefaultDates();
  createParticles();
  initCharts();
  setupEventListeners();
  setupVoiceCommands();
  updateDateTime();
  createScrollToTopButton();
  showPageLoadAnimation();
  
  if (currentTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.querySelector('.theme-toggle').innerHTML = '<i class="fas fa-sun"></i> <span>Light Mode</span>';
  }
  
  loadEntries('inward');
  updateCharts();
  updateProfitDashboard();
  setInterval(checkLowInventory, 30000);
  setInterval(updateDateTime, 1000);
  
  showToast('Welcome to Hybrid Seed Inventory Pro!', 'success');
}

// LOGIN SYSTEM
function showLoginModal() {
  const loginModal = document.createElement('div');
  loginModal.className = 'modal active';
  loginModal.id = 'loginModal';
  loginModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Login Required</h3>
      </div>
      <form id="loginForm">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" required placeholder="Enter username">
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <div class="password-input">
            <input type="password" id="password" required placeholder="Enter password">
            <button type="button" class="password-toggle" onclick="togglePassword()">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button type="submit" class="btn btn-primary">
            <i class="fas fa-sign-in-alt"></i> Login
          </button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(loginModal);
  
 document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  if (!validatePassword(password)) {
    showToast('Password must be at least 8 characters with uppercase, lowercase, number, and special character', 'error');
    return;
  }
    
    if (username === 'admin' && password === 'admin123') {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('currentUser', username);
      isLoggedIn = true;
      currentUser = username;
      loginModal.remove();
      initializeApp();
    } else {
      showToast('Invalid credentials! Use admin/admin123', 'error');
    }
  });
}

function togglePassword() {
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.querySelector('.password-toggle i');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleBtn.className = 'fas fa-eye-slash';
  } else {
    passwordInput.type = 'password';
    toggleBtn.className = 'fas fa-eye';
  }
}
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return password.length >= minLength && 
         hasUpperCase && 
         hasLowerCase && 
         hasNumbers && 
         hasSpecialChars;
}

// DATA MANAGEMENT FUNCTIONS
async function saveData(type, data) {
  return new Promise((resolve, reject) => {
    try {
      // Add unique ID and timestamp
      data.id = Date.now().toString();
      data.timestamp = new Date().toISOString();
      
      // Push to appropriate array
      inventoryData[type].unshift(data);
      
      // Save to localStorage
      localStorage.setItem('inventoryData', JSON.stringify(inventoryData));
      
      // Update charts and UI
      updateCharts();
      updateProfitDashboard();
      loadEntries(type);
      
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

function loadEntries(type) {
  const container = document.getElementById(`${type}Entries`);
  if (!container) return;
  
  // Sort by date (newest first)
  const sortedData = [...inventoryData[type]].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  container.innerHTML = sortedData.map(entry => `
    <div class="entry-card" data-id="${entry.id}">
      <div class="entry-header">
        <h4>${entry.seedName}</h4>
        <span class="quantity-badge">${parseFloat(entry.quantity).toFixed(2)} kg</span>
      </div>
      <div class="entry-details">
        <p><strong>Date:</strong> ${entry.date}</p>
        ${type === 'inward' || type === 'outward' ? `<p><strong>${type === 'inward' ? 'Supplier' : 'Customer'}:</strong> ${entry.party}</p>` : ''}
        ${type === 'returns' ? `<p><strong>Reason:</strong> ${entry.reason}</p>` : ''}
        ${type === 'expiry' ? `<p><strong>Expiry Date:</strong> ${entry.expiryDate}</p>` : ''}
        <p><strong>Notes:</strong> ${entry.notes || 'N/A'}</p>
      </div>
      <div class="entry-actions">
        <button class="btn btn-sm btn-edit" onclick="editEntry('${type}', '${entry.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-sm btn-delete" onclick="deleteEntry('${type}', '${entry.id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('');
  
  // Update result count
  const resultCount = document.getElementById(`${type}ResultCount`);
  if (resultCount) {
    resultCount.textContent = `Showing ${sortedData.length} of ${sortedData.length} entries`;
  }
  
  // Initialize filter dropdowns
  initFilterDropdowns(type);
}

function initFilterDropdowns(type) {
  const filterSelect = document.getElementById(`${type}Filter`);
  if (!filterSelect) return;
  
  filterSelect.innerHTML = '<option value="">All Entries</option>';
  
  let uniqueValues = [];
  if (type === 'inward' || type === 'outward') {
    uniqueValues = [...new Set(inventoryData[type].map(item => item.party))];
  } else if (type === 'returns') {
    uniqueValues = [...new Set(inventoryData[type].map(item => item.reason))];
  } else if (type === 'expiry') {
    uniqueValues = [...new Set(inventoryData[type].map(item => item.action))];
  }
  
  uniqueValues.forEach(value => {
    if (value) {
      filterSelect.innerHTML += `<option value="${value}">${value}</option>`;
    }
  });
}

function filterEntries(type) {
  const searchTerm = document.getElementById(`${type}Search`).value.toLowerCase();
  const filterValue = document.getElementById(`${type}Filter`).value;
  const fromDate = document.getElementById(`${type}FromDate`)?.value;
  const toDate = document.getElementById(`${type}ToDate`)?.value;
  
  let filteredData = [...inventoryData[type]];
  
  // Apply search filter
  if (searchTerm) {
    filteredData = filteredData.filter(item => 
      Object.values(item).some(val => 
        val && val.toString().toLowerCase().includes(searchTerm)
      )
    );
  }
  
  // Apply dropdown filter
  if (filterValue) {
    if (type === 'inward' || type === 'outward') {
      filteredData = filteredData.filter(item => item.party === filterValue);
    } else if (type === 'returns') {
      filteredData = filteredData.filter(item => item.reason === filterValue);
    } else if (type === 'expiry') {
      filteredData = filteredData.filter(item => item.action === filterValue);
    }
  }
  
  // Apply date filter
  if (fromDate) {
    filteredData = filteredData.filter(item => item.date >= fromDate);
  }
  if (toDate) {
    filteredData = filteredData.filter(item => item.date <= toDate);
  }
  
  // Update UI
  const container = document.getElementById(`${type}Entries`);
  if (container) {
    container.innerHTML = filteredData.map(entry => `
      <div class="entry-card" data-id="${entry.id}">
        <div class="entry-header">
          <h4>${entry.seedName}</h4>
          <span class="quantity-badge">${parseFloat(entry.quantity).toFixed(2)} kg</span>
        </div>
        <div class="entry-details">
          <p><strong>Date:</strong> ${entry.date}</p>
          ${type === 'inward' || type === 'outward' ? `<p><strong>${type === 'inward' ? 'Supplier' : 'Customer'}:</strong> ${entry.party}</p>` : ''}
          ${type === 'returns' ? `<p><strong>Reason:</strong> ${entry.reason}</p>` : ''}
          ${type === 'expiry' ? `<p><strong>Expiry Date:</strong> ${entry.expiryDate}</p>` : ''}
          <p><strong>Notes:</strong> ${entry.notes || 'N/A'}</p>
        </div>
        <div class="entry-actions">
          <button class="btn btn-sm btn-edit" onclick="editEntry('${type}', '${entry.id}')">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn btn-sm btn-delete" onclick="deleteEntry('${type}', '${entry.id}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `).join('');
  }
  
  // Update result count
  const resultCount = document.getElementById(`${type}ResultCount`);
  if (resultCount) {
    resultCount.textContent = `Showing ${filteredData.length} of ${inventoryData[type].length} entries`;
  }
}

function editEntry(type, id) {
  const entry = inventoryData[type].find(item => item.id === id);
  if (!entry) return;

  const form = document.getElementById(`${type}Form`);
  if (!form) return;

  // Fill form with entry data
  Object.keys(entry).forEach(key => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) {
      input.value = entry[key];
    }
  });

  // Change submit button to update
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Entry';
  submitBtn.onclick = function(e) {
    e.preventDefault();
    updateEntry(type, id);
  };

  // Scroll to form
  form.scrollIntoView({ behavior: 'smooth' });
}

function updateEntry(type, id) {
  const form = document.getElementById(`${type}Form`);
  if (!form) return;

  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  const errors = validateForm(data, type);
  
  if (errors.length > 0) {
    showToast(errors.join('<br>'), 'error');
    return;
  }

  // Find and update entry
  const index = inventoryData[type].findIndex(item => item.id === id);
  if (index !== -1) {
    inventoryData[type][index] = { ...data, id };
    localStorage.setItem('inventoryData', JSON.stringify(inventoryData));
    
    // Reset form and UI
    form.reset();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Entry';
    submitBtn.onclick = function(e) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    };
    
    loadEntries(type);
    updateCharts();
    updateProfitDashboard();
    showToast('Entry updated successfully!', 'success');
  }
}

function deleteEntry(type, id) {
  if (!confirm('Are you sure you want to delete this entry?')) return;

  inventoryData[type] = inventoryData[type].filter(item => item.id !== id);
  localStorage.setItem('inventoryData', JSON.stringify(inventoryData));
  
  loadEntries(type);
  updateCharts();
  updateProfitDashboard();
  showToast('Entry deleted successfully!', 'success');
}

// VALIDATION FUNCTIONS

// Enhanced form validation
function validateForm(formData, type) {
  const errors = [];
  
  // Seed name validation
  if (!formData.seedName || formData.seedName.trim() === '') {
    errors.push('Seed name is required');
  } else if (formData.seedName.length > 100) {
    errors.push('Seed name must be less than 100 characters');
  }
  
  // Quantity validation
  if (!formData.quantity || isNaN(formData.quantity)) {
    errors.push('Quantity must be a number');
  } else if (parseFloat(formData.quantity) <= 0) {
    errors.push('Quantity must be greater than 0');
  } else if (parseFloat(formData.quantity) > 10000) {
    errors.push('Quantity must be less than 10,000 kg');
  }
  
  // Date validation
  if (!formData.date) {
    errors.push('Date is required');
  } else if (new Date(formData.date) > new Date()) {
    errors.push('Date cannot be in the future');
  }
  
  // Additional type-specific validations
  if (type === 'expiry' && formData.expiryDate && new Date(formData.expiryDate) < new Date()) {
    errors.push('Expiry date must be in the future');
  }
  
  return errors;
}
// UI FUNCTIONS
function showToast(message, type = 'success', duration = 5000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} animate-slide-in`;
  let icon;
  switch (type) {
    case 'error': icon = '<i class="fas fa-times-circle"></i>'; break;
    case 'warning': icon = '<i class="fas fa-exclamation-triangle"></i>'; break;
    case 'info': icon = '<i class="fas fa-info-circle"></i>'; break;
    default: icon = '<i class="fas fa-check-circle"></i>';
  }
  toast.innerHTML = `${icon} <span>${message}</span>`;
  
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  toastContainer.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('animate-slide-out');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

function showTab(tabId) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Deactivate all tab buttons
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.classList.remove('active');
  });
  
  // Show selected tab content
  const tabContent = document.getElementById(tabId);
  if (tabContent) {
    tabContent.classList.add('active');
  }
  
  // Activate selected tab button
  const tabButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (tabButton) {
    tabButton.classList.add('active');
  }
  
  // Load entries for the tab
  if (tabId !== 'dashboard' && tabId !== 'reports' && tabId !== 'ai-insights') {
    loadEntries(tabId);
  }
  
  // Update charts if dashboard or reports
  if (tabId === 'dashboard' || tabId === 'reports') {
    updateCharts();
  }
  
  // Update profit dashboard if showing
  if (tabId === 'dashboard') {
    updateProfitDashboard();
  }
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', currentTheme);
  
  document.body.setAttribute('data-theme', currentTheme);
  const themeToggle = document.querySelector('.theme-toggle');
  
  if (currentTheme === 'dark') {
    themeToggle.innerHTML = '<i class="fas fa-sun"></i> <span>Light Mode</span>';
  } else {
    themeToggle.innerHTML = '<i class="fas fa-moon"></i> <span>Dark Mode</span>';
  }
  
  // Update charts with new theme colors
  updateCharts();
}

// PROFIT DASHBOARD FUNCTIONS
function updateProfitDashboard() {
  // Calculate sample profit/loss data (in a real app, this would come from your data)
  const sampleRevenue = inventoryData.outward.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * 100), 0); // Assuming ₹100 per kg
  const sampleCosts = inventoryData.inward.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * 70), 0); // Assuming ₹70 per kg cost
  const profit = sampleRevenue - sampleCosts;
  const margin = sampleRevenue > 0 ? ((profit / sampleRevenue) * 100).toFixed(1) : 0;
  
  // Update the dashboard elements
  document.getElementById('totalRevenue').textContent = '₹' + sampleRevenue.toLocaleString();
  document.getElementById('totalCosts').textContent = '₹' + sampleCosts.toLocaleString();
  document.getElementById('grossProfit').textContent = '₹' + profit.toLocaleString();
  document.getElementById('profitMargin').textContent = margin + '%';
}

function generateProfitReport() {
  updateProfitDashboard();
  showToast('Profit & Loss report generated!', 'success');
}

// CHART FUNCTIONS
function initCharts() {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
        },
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
        }
      },
      x: {
        ticks: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
        },
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
        }
      }
    }
  };
  
  // Inventory Chart (Bar)
  const inventoryCtx = document.getElementById('inventoryChart')?.getContext('2d');
  if (inventoryCtx) {
    charts.inventoryChart = new Chart(inventoryCtx, {
      type: 'bar',
      data: {
        labels: ['Inward', 'Outward', 'Returns', 'Expired'],
        datasets: [{
          label: 'Quantity (kg)',
          data: [0, 0, 0, 0],
          backgroundColor: [
            'rgba(16, 185, 129, 0.7)',
            'rgba(59, 130, 246, 0.7)',
            'rgba(249, 115, 22, 0.7)',
            'rgba(239, 68, 68, 0.7)'
          ],
          borderColor: [
            'rgba(16, 185, 129, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(249, 115, 22, 1)',
            'rgba(239, 68, 68, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: chartOptions
    });
  }

  // Seed Distribution Chart (Doughnut)
  const seedCtx = document.getElementById('seedChart')?.getContext('2d');
  if (seedCtx) {
    charts.seedChart = new Chart(seedCtx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1
        }]
      },
      options: {
        ...chartOptions,
        cutout: '70%'
      }
    });
  }

  // Expiry Status Chart (Pie)
  const expiryCtx = document.getElementById('expiryChart')?.getContext('2d');
  if (expiryCtx) {
    charts.expiryChart = new Chart(expiryCtx, {
      type: 'pie',
      data: {
        labels: ['Active', 'Expiring Soon', 'Expired'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: [
            'rgba(16, 185, 129, 0.7)',
            'rgba(249, 115, 22, 0.7)',
            'rgba(239, 68, 68, 0.7)'
          ],
          borderColor: [
            'rgba(16, 185, 129, 1)',
            'rgba(249, 115, 22, 1)',
            'rgba(239, 68, 68, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.raw}kg`;
              }
            }
          }
        }
      }
    });
  }

  // Movement Chart (Line)
  const movementCtx = document.getElementById('movementChart')?.getContext('2d');
  if (movementCtx) {
    charts.movementChart = new Chart(movementCtx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
          {
            label: 'Inward',
            data: [],
            borderColor: 'rgba(16, 185, 129, 1)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Outward',
            data: [],
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: chartOptions
    });
  }

  // Customer/Supplier Chart (Bar)
  const customerCtx = document.getElementById('customerChart')?.getContext('2d');
  if (customerCtx) {
    charts.customerChart = new Chart(customerCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Quantity (kg)',
          data: [],
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }]
      },
      options: chartOptions
    });
  }
}

function updateCharts() {
  if (!charts.inventoryChart) return;

  // Inventory Summary Chart
  const totalInward = inventoryData.inward.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
  const totalOutward = inventoryData.outward.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
  const totalReturns = inventoryData.returns.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
  const totalExpired = inventoryData.expiry.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
  
  charts.inventoryChart.data.datasets[0].data = [totalInward, totalOutward, totalReturns, totalExpired];
  charts.inventoryChart.update();

  // Seed Distribution Chart
  const seedDistribution = {};
  inventoryData.inward.forEach(item => {
    seedDistribution[item.seedName] = (seedDistribution[item.seedName] || 0) + parseFloat(item.quantity || 0);
  });
  inventoryData.outward.forEach(item => {
    seedDistribution[item.seedName] = (seedDistribution[item.seedName] || 0) - parseFloat(item.quantity || 0);
  });
  inventoryData.returns.forEach(item => {
    seedDistribution[item.seedName] = (seedDistribution[item.seedName] || 0) + parseFloat(item.quantity || 0);
  });
  
  const seedLabels = Object.keys(seedDistribution).filter(seed => seedDistribution[seed] > 0);
  const seedData = seedLabels.map(seed => seedDistribution[seed]);
  
  // Generate distinct colors for each seed type
  const seedColors = seedLabels.map((_, i) => {
    const hue = (i * 137.508) % 360; // Golden angle for distinct colors
    return `hsla(${hue}, 70%, 60%, 0.7)`;
  });
  
  if (charts.seedChart) {
    charts.seedChart.data.labels = seedLabels;
    charts.seedChart.data.datasets[0].data = seedData;
    charts.seedChart.data.datasets[0].backgroundColor = seedColors;
    charts.seedChart.update();
  }

  // Expiry Status Chart (simplified example)
  if (charts.expiryChart) {
    const active = inventoryData.expiry.filter(item => item.action === 'used').reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    const expired = inventoryData.expiry.filter(item => item.action === 'destroyed').reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    const expiringSoon = inventoryData.expiry.filter(item => item.action === 'returned').reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    
    charts.expiryChart.data.datasets[0].data = [active, expiringSoon, expired];
    charts.expiryChart.update();
  }

  // Movement Chart (by month)
  if (charts.movementChart) {
    const monthlyInward = Array(12).fill(0);
    const monthlyOutward = Array(12).fill(0);
    
    inventoryData.inward.forEach(item => {
      const month = new Date(item.date).getMonth();
      monthlyInward[month] += parseFloat(item.quantity || 0);
    });
    
    inventoryData.outward.forEach(item => {
      const month = new Date(item.date).getMonth();
      monthlyOutward[month] += parseFloat(item.quantity || 0);
    });
    
    charts.movementChart.data.datasets[0].data = monthlyInward;
    charts.movementChart.data.datasets[1].data = monthlyOutward;
    charts.movementChart.update();
  }

  // Customer/Supplier Chart (top 5)
  if (charts.customerChart) {
    const customerData = {};
    inventoryData.outward.forEach(item => {
      customerData[item.party] = (customerData[item.party] || 0) + parseFloat(item.quantity || 0);
    });
    
    const sortedCustomers = Object.entries(customerData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    charts.customerChart.data.labels = sortedCustomers.map(item => item[0]);
    charts.customerChart.data.datasets[0].data = sortedCustomers.map(item => item[1]);
    charts.customerChart.update();
  }
}

// AI ASSISTANT FUNCTIONS
function askAI(feature) {
  const responses = {
    'inventory-optimization': 'Based on your current stock levels and sales patterns, I recommend maintaining 15-20 days of safety stock for wheat seeds and reducing corn seed inventory by 10%.',
    'demand-forecasting': 'Seasonal analysis shows 35% increase in vegetable seed demand expected next month. Consider increasing tomato and cabbage seed stock.',
    'profit-analysis': 'Premium hybrid varieties show 42% higher profit margins. Focus on promoting varieties with batch codes starting with "HYB" for maximum profitability.',
    'market-insights': 'Current market trends indicate organic seeds are in high demand with 25% price premium. Consider expanding organic seed varieties.'
  };
  
  // Add the response to chat
  const chatMessages = document.getElementById('chatMessages');
  const aiMsg = document.createElement('div');
  aiMsg.className = 'ai-message';
  aiMsg.innerHTML = `<strong>AI Assistant:</strong> ${responses[feature]}`;
  chatMessages.appendChild(aiMsg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  showToast('AI recommendation generated!', 'success');
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  
  const chatMessages = document.getElementById('chatMessages');
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'user-message';
  userMsg.innerHTML = '<strong>You:</strong> ' + message;
  chatMessages.appendChild(userMsg);
  
  // Clear input
  input.value = '';
  
  // Simulate AI thinking
  const thinkingMsg = document.createElement('div');
  thinkingMsg.className = 'ai-message thinking';
  thinkingMsg.innerHTML = '<strong>AI Assistant:</strong> Thinking...';
  chatMessages.appendChild(thinkingMsg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Simulate AI response after delay
  setTimeout(() => {
    thinkingMsg.remove();
    
    const aiResponse = generateAIResponse(message);
    const aiMsg = document.createElement('div');
    aiMsg.className = 'ai-message';
    aiMsg.innerHTML = '<strong>AI Assistant:</strong> ' + aiResponse;
    chatMessages.appendChild(aiMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 1500);
}

function generateAIResponse(message) {
  // This would be replaced with actual AI API calls in a real implementation
  const responses = [
    "Based on your inventory data, I recommend increasing stock of wheat seeds by 15% for the upcoming season.",
    "Your sales data shows that hybrid corn seeds are your best selling product with a 25% profit margin.",
    "Market trends indicate increasing demand for organic seeds. Consider expanding your organic product line.",
    "Analysis shows that 15% of your inventory will expire in the next 30 days. Consider running promotions.",
    "Your top customer is Sharma Seeds, accounting for 30% of your outward movements."
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function startVoiceInput() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    
    recognition.onstart = function() {
      showToast('Listening... Speak now', 'info');
    };
    
    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      document.getElementById('chatInput').value = transcript;
      sendChatMessage();
    };
    
    recognition.onerror = function(event) {
      showToast('Voice recognition error: ' + event.error, 'error');
    };
    
    recognition.start();
  } else {
    showToast('Voice recognition not supported in this browser', 'error');
  }
}

function toggleAIAssistant() {
  showTab('ai-insights');
}

// UTILITY FUNCTIONS
function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(input => {
    if (!input.value) {
      input.value = today;
    }
  });
}

function checkLowInventory() {
  const seedStock = {};
  
  // Calculate current stock
  inventoryData.inward.forEach(item => {
    seedStock[item.seedName] = (seedStock[item.seedName] || 0) + parseFloat(item.quantity || 0);
  });
  inventoryData.outward.forEach(item => {
    seedStock[item.seedName] = (seedStock[item.seedName] || 0) - parseFloat(item.quantity || 0);
  });
  inventoryData.returns.forEach(item => {
    seedStock[item.seedName] = (seedStock[item.seedName] || 0) + parseFloat(item.quantity || 0);
  });
  
  // Check for low stock
  const lowStockItems = [];
  const criticalStockItems = [];
  
  Object.entries(seedStock).forEach(([seedName, stock]) => {
    if (stock <= 5 && stock > 0) {
      criticalStockItems.push({ seedName, stock });
    } else if (stock <= 15) {
      lowStockItems.push({ seedName, stock });
    }
  });
  
  if (criticalStockItems.length > 0) {
    const message = `Critical stock alert! ${criticalStockItems.map(item => 
      `${item.seedName}: ${item.stock.toFixed(1)}kg`
    ).join(', ')}`;
    showToast(message, 'error', 10000);
  } else if (lowStockItems.length > 0) {
    const message = `Low stock warning! ${lowStockItems.map(item => 
      `${item.seedName}: ${item.stock.toFixed(1)}kg`
    ).join(', ')}`;
    showToast(message, 'warning', 8000);
  }
}

function createParticles() {
  // Only create particles once
  if (document.getElementById('particles-js')) return;

  const particlesDiv = document.createElement('div');
  particlesDiv.id = 'particles-js';
  particlesDiv.style.position = 'fixed';
  particlesDiv.style.top = '0';
  particlesDiv.style.left = '0';
  particlesDiv.style.width = '100%';
  particlesDiv.style.height = '100%';
  particlesDiv.style.zIndex = '-1';
  document.body.appendChild(particlesDiv);

  // Initialize particles.js if available
  if (window.particlesJS) {
    particlesJS('particles-js', {
      particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: currentTheme === 'dark' ? '#ffffff' : '#000000' },
        shape: { type: 'circle' },
        opacity: { value: 0.3, random: true },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: currentTheme === 'dark' ? '#ffffff' : '#000000', opacity: 0.2, width: 1 },
        move: { enable: true, speed: 2, direction: 'none', random: true, straight: false, out_mode: 'out' }
      },
      interactivity: {
        detect_on: 'canvas',
        events: {
          onhover: { enable: true, mode: 'repulse' },
          onclick: { enable: true, mode: 'push' }
        }
      }
    });
  }
}

function updateDateTime() {
  const now = new Date();
  const dateTimeString = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
        hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  const dateTimeElement = document.getElementById('currentDateTime');
  if (dateTimeElement) {
    dateTimeElement.textContent = dateTimeString;
  }
}

function createScrollToTopButton() {
  const scrollButton = document.createElement('button');
  scrollButton.id = 'scrollToTopBtn';
  scrollButton.className = 'scroll-to-top';
  scrollButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
  scrollButton.title = 'Scroll to top';
  scrollButton.onclick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  document.body.appendChild(scrollButton);
  
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      scrollButton.style.display = 'block';
    } else {
      scrollButton.style.display = 'none';
    }
  });
}

function showPageLoadAnimation() {
  const loader = document.createElement('div');
  loader.className = 'page-loader';
  loader.innerHTML = `
    <div class="loader-content">
      <div class="loader-spinner"></div>
      <div class="loader-text">Loading Hybrid Seed Inventory Pro...</div>
    </div>
  `;
  
  document.body.appendChild(loader);
  
  setTimeout(() => {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 500);
  }, 1500);
}

// Improved export function with error handling
async function exportToCSV(type) {
  try {
    const data = inventoryData[type];
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }
    
    // Get headers from the first object
    const headers = Object.keys(data[0]);
    
    // Create CSV content with proper escaping
    let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n';
    
    data.forEach(item => {
      const row = headers.map(header => {
        let value = item[header] || '';
        if (typeof value === 'string') {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += row.join(',') + '\r\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}_data_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    showToast(`${type} data exported successfully!`, 'success');
  } catch (error) {
    showToast(`Export failed: ${error.message}`, 'error');
    console.error('Export error:', error);
  }
}

function printReport(type) {
  const printWindow = window.open('', '_blank');
  const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Report`;
  
  let htmlContent = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .footer { margin-top: 20px; text-align: right; font-size: 0.8em; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
  `;
  
  // Add headers
const headers = Object.keys(inventoryData[type][0] || {});
headers.forEach(header => {
  htmlContent += `<th>${header}</th>`;
});
  htmlContent += `
            </tr>
          </thead>
          <tbody>
  `;
  
  // Add data rows
  inventoryData[type].forEach(item => {
    htmlContent += '<tr>';
    headers.forEach(header => {
      htmlContent += `<td>${item[header] || ''}</td>`;
    });
    htmlContent += '</tr>';
  });
  
  htmlContent += `
          </tbody>
        </table>
        <div class="footer">
          <p>Generated by Hybrid Seed Inventory Pro</p>
        </div>
      </body>
    </html>
  `;
  
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

function setupEventListeners() {
  // Theme toggle
  document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
  
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
  
  // Form submissions
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const formData = new FormData(this);
      const data = Object.fromEntries(formData);
      const type = this.id.replace('Form', '');
      
      const errors = validateForm(data, type);
      if (errors.length > 0) {
        showToast(errors.join('<br>'), 'error');
        return;
      }
      
      saveData(type, data)
        .then(() => {
          this.reset();
          showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} entry added successfully!`, 'success');
        })
        .catch(err => {
          showToast('Error saving data: ' + err.message, 'error');
        });
    });
  });
  
  // Search and filter events
  document.querySelectorAll('.search-input').forEach(input => {
    input.addEventListener('input', function() {
      const type = this.id.replace('Search', '');
      filterEntries(type);
    });
  });
  
  document.querySelectorAll('.filter-select').forEach(select => {
    select.addEventListener('change', function() {
      const type = this.id.replace('Filter', '');
      filterEntries(type);
    });
  });
  
  // Date filter events
  document.querySelectorAll('.date-filter').forEach(input => {
    input.addEventListener('change', function() {
      const type = this.id.replace('FromDate', '').replace('ToDate', '');
      filterEntries(type);
    });
  });
  
  // AI Assistant features
  document.querySelectorAll('.ai-feature-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      askAI(this.dataset.feature);
    });
  });
  
  // Chat input
  document.getElementById('chatInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
  
  document.getElementById('sendChatBtn')?.addEventListener('click', sendChatMessage);
  document.getElementById('voiceInputBtn')?.addEventListener('click', startVoiceInput);
  
  // Export and print buttons
  document.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      exportToCSV(this.dataset.type);
    });
  });
  
  document.querySelectorAll('.print-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      printReport(this.dataset.type);
    });
  });
  
  // Profit report generation
  document.getElementById('generateProfitReport')?.addEventListener('click', generateProfitReport);
  
  // AI Assistant toggle
  document.getElementById('aiAssistantBtn')?.addEventListener('click', toggleAIAssistant);
}

function setupVoiceCommands() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = function(event) {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      
      if (event.results[0].isFinal) {
        processVoiceCommand(transcript.toLowerCase());
      }
    };
    
    recognition.onerror = function(event) {
      console.error('Voice recognition error', event.error);
    };
    
    recognition.start();
  }
}

function processVoiceCommand(command) {
  if (command.includes('show dashboard')) {
    showTab('dashboard');
    showToast('Showing dashboard', 'success');
  } else if (command.includes('show inward')) {
    showTab('inward');
    showToast('Showing inward entries', 'success');
  } else if (command.includes('show outward')) {
    showTab('outward');
    showToast('Showing outward entries', 'success');
  } else if (command.includes('show returns')) {
    showTab('returns');
    showToast('Showing returns', 'success');
  } else if (command.includes('show expiry')) {
    showTab('expiry');
    showToast('Showing expiry management', 'success');
  } else if (command.includes('show reports')) {
    showTab('reports');
    showToast('Showing reports', 'success');
  } else if (command.includes('show ai insights')) {
    showTab('ai-insights');
    showToast('Showing AI insights', 'success');
  } else if (command.includes('dark mode')) {
    if (currentTheme !== 'dark') toggleTheme();
    showToast('Switched to dark mode', 'success');
  } else if (command.includes('light mode')) {
    if (currentTheme === 'dark') toggleTheme();
    showToast('Switched to light mode', 'success');
  } else if (command.includes('generate report')) {
    generateProfitReport();
  } else if (command.includes('logout')) {
    localStorage.setItem('isLoggedIn', 'false');
    isLoggedIn = false;
    showLoginModal();
    showToast('Logged out successfully', 'success');
  }
}

// Initialize the application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}