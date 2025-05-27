document.addEventListener("DOMContentLoaded", function () {
    // Theme Toggle Functionality
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    const savedTheme = localStorage.getItem('admin-theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        themeToggle.textContent = '☀️';
    }

    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        if (body.classList.contains('dark-theme')) {
            localStorage.setItem('admin-theme', 'dark');
            themeToggle.textContent = '☀️';
        } else {
            localStorage.setItem('admin-theme', 'light');
            themeToggle.textContent = '🌙';
        }
    });

    // Navigation Active State Persistence
    const navLinks = document.querySelectorAll('.sidebar-menu a');

    function updateActiveMenu(selectedLink) {
        navLinks.forEach(link => link.classList.remove('active'));
        selectedLink.classList.add('active');
        localStorage.setItem('activeNav', selectedLink.getAttribute('href'));
    }

    // Apply active class from localStorage
    let savedActiveNav = localStorage.getItem('activeNav');

    let isActiveSet = false;
    navLinks.forEach(link => {
        if (link.getAttribute('href') === savedActiveNav) {
            link.classList.add('active');
            isActiveSet = true;
        }
        // Add click event to update active class
        link.addEventListener('click', function () {
            updateActiveMenu(this);
        });
    });

    // If no active link is set, make Dashboard active by default
    if (!isActiveSet) {
        const dashboardLink = document.querySelector('.sidebar-menu a[href="/admin/dashboard"]');
        if (dashboardLink) {
            dashboardLink.classList.add('active');
            localStorage.setItem('activeNav', "/admin/dashboard");
        }
    }
});
