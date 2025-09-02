const QUERY_TYPES = [
  {
    title: 'All',
    value: '/assets-search/',
  },
  {
    title: 'Assets',
    value: '/drafts/inedoviesov/assets-search/',
  },
  {
    title: 'Products',
    value: '/drafts/inedoviesov/search-products/',
  },
];

export default function decorate(block) {
  // Create the main container
  const queryInputContainer = document.createElement('div');
  queryInputContainer.className = 'query-input-container';

  // Create the input bar
  const queryInputBar = document.createElement('div');
  queryInputBar.className = 'query-input-bar';

  // Dropdown
  const queryDropdown = document.createElement('div');
  queryDropdown.className = 'query-dropdown';

  // Create custom dropdown instead of select
  const searchTypeSelect = document.createElement('div');
  searchTypeSelect.className = 'custom-select';

  const selectedOption = document.createElement('div');
  selectedOption.className = 'selected-option';
  selectedOption.innerHTML = '<span class="selected-text">Assets</span>';

  const optionsList = document.createElement('div');
  optionsList.className = 'options-list';

  // Create options from QUERY_TYPES array
  QUERY_TYPES.forEach((queryType) => {
    const option = document.createElement('div');
    option.className = 'option';
    option.textContent = queryType.title;
    option.dataset.value = queryType.value;
    option.addEventListener('click', () => {
      // Remove selected class from all options
      optionsList.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
      // Add selected class to clicked option
      option.classList.add('selected');

      selectedOption.querySelector('.selected-text').textContent = queryType.title;
      selectedOption.dataset.value = queryType.value;
      searchTypeSelect.dataset.value = queryType.value;
      optionsList.style.display = 'none';
      searchTypeSelect.classList.remove('open');
    });
    optionsList.append(option);
  });

  // Toggle dropdown
  selectedOption.addEventListener('click', () => {
    const isOpen = searchTypeSelect.classList.contains('open');
    if (isOpen) {
      optionsList.style.display = 'none';
      searchTypeSelect.classList.remove('open');
    } else {
      optionsList.style.display = 'block';
      searchTypeSelect.classList.add('open');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchTypeSelect.contains(e.target)) {
      optionsList.style.display = 'none';
      searchTypeSelect.classList.remove('open');
    }
  });

  searchTypeSelect.append(selectedOption, optionsList);
  queryDropdown.append(searchTypeSelect);

  // Input wrapper
  const queryInputWrapper = document.createElement('div');
  queryInputWrapper.className = 'query-input-wrapper';

  // Search icon (SVG)
  const querySearchIcon = document.createElement('span');
  querySearchIcon.className = 'query-search-icon';

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('viewBox', '0 0 24 24');

  const circle = document.createElementNS(svgNS, 'circle');
  circle.setAttribute('cx', '11');
  circle.setAttribute('cy', '11');
  circle.setAttribute('r', '8');

  const line = document.createElementNS(svgNS, 'line');
  line.setAttribute('x1', '21');
  line.setAttribute('y1', '21');
  line.setAttribute('x2', '16.65');
  line.setAttribute('y2', '16.65');

  svg.append(circle, line);
  querySearchIcon.append(svg);

  // Input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'query-input';
  input.placeholder = 'What are you looking for?';
  input.autofocus = true;

  queryInputWrapper.append(querySearchIcon, input);

  // Initialize values from URL parameters
  const urlParams = new URLSearchParams(window.location.search);

  const queryParam = urlParams.get('query');
  if (queryParam) {
    input.value = decodeURIComponent(queryParam) || '';
  }

  // Set searchTypeSelect based on current page path
  const currentPath = window.location.pathname;
  const matchingQueryType = QUERY_TYPES.find((queryType) => queryType.value === currentPath);
  const defaultQueryType = matchingQueryType || QUERY_TYPES[0];

  selectedOption.querySelector('.selected-text').textContent = defaultQueryType.title;
  selectedOption.dataset.value = defaultQueryType.value;
  searchTypeSelect.dataset.value = defaultQueryType.value;

  // Mark the default option as selected
  const defaultOption = optionsList.querySelector(`[data-value="${defaultQueryType.value}"]`);
  if (defaultOption) {
    defaultOption.classList.add('selected');
  }


  const performSearch = () => {
    const query = input.value;
    const selectedSearchType = searchTypeSelect.dataset.value;

    // Redirect to assets browser with search parameters
    window.location.href = `${selectedSearchType}?query=${encodeURIComponent(query)}`;
  };

  // Search button
  const searchBtn = document.createElement('button');
  searchBtn.className = 'query-search-btn';
  searchBtn.setAttribute('aria-label', 'Search');
  searchBtn.textContent = 'Search';
  // Add event listener to log input and selected option
  searchBtn.addEventListener('click', performSearch);
  // Add event listeners to match React SearchBar behavior
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  // Assemble everything
  queryInputBar.append(queryDropdown, queryInputWrapper, searchBtn);
  queryInputContainer.append(queryInputBar);

  // Now you can append queryInputContainer to your searchBlock or wherever needed
  block.textContent = '';
  block.append(queryInputContainer);
}
