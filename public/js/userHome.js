document.addEventListener("DOMContentLoaded", function () {
    const track = document.querySelector('.carousel-track');
    const slides = Array.from(document.querySelectorAll('.carousel-slide'));
    const nextButton = document.querySelector('.next-button');
    const prevButton = document.querySelector('.prev-button');
    const dots = Array.from(document.querySelectorAll('.carousel-dot'));
    const carouselContainer = document.querySelector('.carousel-container');

    let currentIndex = 0;
    let autoSlideInterval;

    // Dynamically calculate the slide width
    function getSlideWidth() {
        return carouselContainer.offsetWidth;
    }

    function setSlidePosition() {
        const slideWidth = getSlideWidth();
        track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
        updateDots();
    }

    function updateDots() {
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }

    function moveToNextSlide() {
        currentIndex = (currentIndex + 1) % slides.length;
        setSlidePosition();
    }

    function moveToPrevSlide() {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        setSlidePosition();
    }

    nextButton.addEventListener('click', moveToNextSlide);
    prevButton.addEventListener('click', moveToPrevSlide);

    dots.forEach(dot => {
        dot.addEventListener('click', function () {
            currentIndex = parseInt(this.getAttribute('data-index'));
            setSlidePosition();
        });
    });

    function startAutoSlide() {
        autoSlideInterval = setInterval(moveToNextSlide, 5000);
    }

    function stopAutoSlide() {
        clearInterval(autoSlideInterval);
    }

    // Adjust slide positions on window resize
    window.addEventListener('resize', setSlidePosition);

    // Start auto-scroll
    startAutoSlide();

    // Pause on hover
    carouselContainer.addEventListener('mouseenter', stopAutoSlide);
    carouselContainer.addEventListener('mouseleave', startAutoSlide);

    // Initialize slide positions
    setSlidePosition();
});