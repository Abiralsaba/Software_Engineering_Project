/**
 * Responsive Sidebar Navigation Handler
 * Handles hamburger menu toggle and mobile interactions
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        initSidebar();
    });

    function initSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        // Create hamburger menu button
        const hamburger = createHamburgerButton();
        
        // Create overlay
        const overlay = createOverlay();
        
        // Create mobile close button
        const closeBtn = createCloseButton(sidebar);
        
        // Insert elements into DOM
        document.body.insertBefore(hamburger, document.body.firstChild);
        document.body.insertBefore(overlay, document.body.firstChild);
        
        // Event Listeners
        hamburger.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', closeSidebar);
        closeBtn.addEventListener('click', closeSidebar);
        
        // Close sidebar on navigation link click (mobile)
        const navLinks = sidebar.querySelectorAll('.nav-links a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    closeSidebar();
                }
            });
        });

        // Close sidebar on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeSidebar();
            }
        });

        // Handle window resize
        window.addEventListener('resize', debounce(function() {
            if (window.innerWidth > 768) {
                closeSidebar();
            }
        }, 250));

        // Swipe gesture support for mobile
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, false);

        document.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);

        function handleSwipe() {
            const swipeThreshold = 100;
            const swipeDistance = touchEndX - touchStartX;
            
            // Swipe right to open (only from left edge)
            if (swipeDistance > swipeThreshold && touchStartX < 50) {
                openSidebar();
            }
            // Swipe left to close
            if (swipeDistance < -swipeThreshold && sidebar.classList.contains('active')) {
                closeSidebar();
            }
        }

        // Functions
        function toggleSidebar() {
            sidebar.classList.toggle('active');
            hamburger.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
        }

        function openSidebar() {
            sidebar.classList.add('active');
            hamburger.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            sidebar.classList.remove('active');
            hamburger.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function createHamburgerButton() {
        const button = document.createElement('button');
        button.className = 'hamburger-menu';
        button.setAttribute('aria-label', 'Toggle navigation menu');
        button.innerHTML = '<span></span>';
        return button;
    }

    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        return overlay;
    }

    function createCloseButton(sidebar) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'mobile-close-btn';
        closeBtn.setAttribute('aria-label', 'Close menu');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        sidebar.insertBefore(closeBtn, sidebar.firstChild);
        return closeBtn;
    }

    // Utility: Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
})();
