export default async function decorate(block) {
    const konavigation = document.createElement('div');
    konavigation.className = 'konavigation';

    // Fetch tabs data
    let tabsData;
    try {
        const response = await fetch('./blocks/konavigation/tabs-data.json');
        tabsData = await response.json();
    } catch (error) {
        console.error('Error loading tabs data:', error);
        return;
    }

    let currentTab = tabsData.tabs.find(tab => tab.active) || tabsData.tabs[0];
    let currentBrand = currentTab.brands.find(brand => brand.active) || currentTab.brands[0];

    // Create main navigation tabs
    const mainTabs = document.createElement('div');
    mainTabs.className = 'main-tabs';

    // Create brand navigation
    const brandTabs = document.createElement('div');
    brandTabs.className = 'brand-tabs';

    // Create content grid
    const contentGrid = document.createElement('div');
    contentGrid.className = 'content-grid';

    // Function to render main tabs
    function renderMainTabs() {
        mainTabs.innerHTML = '';
        tabsData.tabs.forEach((tab, index) => {
            const tabElement = document.createElement('button');
            tabElement.className = `main-tab ${tab === currentTab ? 'active' : ''}`;
            tabElement.textContent = tab.name;
            tabElement.addEventListener('click', () => {
                currentTab = tab;
                currentBrand = currentTab.brands.find(brand => brand.active) || currentTab.brands[0];
                renderMainTabs();
                renderBrandTabs();
                renderContent();
            });
            mainTabs.append(tabElement);
        });
    }

    // Function to render brand tabs
    function renderBrandTabs() {
        brandTabs.innerHTML = '';
        if (currentTab.brands && currentTab.brands.length > 0) {
            currentTab.brands.forEach(brand => {
                const brandElement = document.createElement('button');
                brandElement.className = `brand-tab ${brand === currentBrand ? 'active' : ''}`;
                brandElement.textContent = brand.name;
                brandElement.addEventListener('click', () => {
                    currentBrand = brand;
                    renderBrandTabs();
                    renderContent();
                });
                brandTabs.append(brandElement);
            });
        }
    }

    // Function to render content
    function renderContent() {
        contentGrid.innerHTML = '';
        if (currentBrand && currentBrand.initiatives) {
            currentBrand.initiatives.forEach(initiative => {
                const card = document.createElement('div');
                card.className = 'initiative-card';

                const image = document.createElement('img');
                image.src = initiative.image;
                image.alt = initiative.alt;
                image.className = 'initiative-image';

                const title = document.createElement('h3');
                title.className = 'initiative-title';
                title.textContent = initiative.title;

                card.append(image, title);
                contentGrid.append(card);
            });
        }
    }

    // Initial render
    renderMainTabs();
    renderBrandTabs();
    renderContent();

    konavigation.append(mainTabs, brandTabs, contentGrid);

    block.textContent = '';
    block.append(konavigation);
}