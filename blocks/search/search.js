import {
  convertHtmlListToArray,
  fetchSpreadsheetData,
  getBlockKeyValues,
} from '../../scripts/scripts.js';

function createCustomDropdown(pathObjects) {
  // Create custom dropdown instead of select
  const searchTypeSelect = document.createElement('div');
  searchTypeSelect.className = 'custom-select';

  const selectedOption = document.createElement('div');
  selectedOption.className = 'selected-option';
  selectedOption.innerHTML = '<span class="selected-text">Assets</span>';

  const optionsList = document.createElement('div');
  optionsList.className = 'options-list';

  // Create options from pathObjects array
  pathObjects.forEach((queryType) => {
    const option = document.createElement('div');
    option.className = 'option';
    option.textContent = queryType.title;
    option.dataset.value = queryType.value;
    option.addEventListener('click', () => {
      // Remove selected class from all options
      optionsList.querySelectorAll('.option').forEach((opt) => opt.classList.remove('selected'));
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

  return { searchTypeSelect, selectedOption, optionsList };
}

export default async function decorate(block) {
  const searchObj = getBlockKeyValues(block);

  let pathObjects = [];
  if (searchObj?.paths) { // block has own paths configured
    const pathArray = convertHtmlListToArray(searchObj.paths);

    // Convert pathArray from "title: value" strings to objects
    pathObjects = pathArray.map((item) => {
      const [title, value] = item.split(':')
        .map((part) => part.trim());
      return {
        title,
        value,
      };
    });
  } else if (searchObj?.paths === undefined) { // fallback to centrally configured search page paths
    const configs = await fetchSpreadsheetData('configs', 'search-pages');
    pathObjects = configs?.data || [];
  }

  // Create the main container
  const queryInputContainer = document.createElement('div');
  queryInputContainer.className = 'query-input-container';

  // Create the input bar
  const queryInputBar = document.createElement('div');
  queryInputBar.className = 'query-input-bar';

  // Dropdown
  const queryDropdown = document.createElement('div');
  queryDropdown.className = 'query-dropdown';

  // Create custom dropdown using the extracted method only if pathObjects has items
  let searchTypeSelect;
  let selectedOption;
  let optionsList;
  if (pathObjects.length > 0) {
    const dropdown = createCustomDropdown(pathObjects);
    searchTypeSelect = dropdown.searchTypeSelect;
    selectedOption = dropdown.selectedOption;
    optionsList = dropdown.optionsList;
    queryDropdown.append(searchTypeSelect);
  }

  // Input wrapper
  const queryInputWrapper = document.createElement('div');
  queryInputWrapper.className = 'query-input-wrapper';

  // Search icon
  const querySearchIcon = document.createElement('span');
  querySearchIcon.className = 'query-search-icon';

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

  // Set searchTypeSelect based on current page path (only if dropdown exists)
  if (pathObjects.length > 0 && selectedOption) {
    const currentPath = window.location.pathname;
    const matchingQueryType = pathObjects.find((queryType) => queryType.value === currentPath);
    const defaultQueryType = matchingQueryType || pathObjects[0];

    selectedOption.querySelector('.selected-text').textContent = defaultQueryType.title;
    selectedOption.dataset.value = defaultQueryType.value;
    searchTypeSelect.dataset.value = defaultQueryType.value;

    // Mark the default option as selected
    const defaultOption = optionsList.querySelector(`[data-value="${defaultQueryType.value}"]`);
    if (defaultOption) {
      defaultOption.classList.add('selected');
    }
  }

  const performSearch = () => {
    const query = input.value;

    // If no dropdown exists, use a current page path
    const selectedSearchPath = searchTypeSelect?.dataset.value || window.location.pathname;

    // Redirect to search page with search parameters
    window.location.href = `${selectedSearchPath}?query=${encodeURIComponent(query)}`;
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
  if (pathObjects.length > 0) {
    queryInputBar.append(queryDropdown, queryInputWrapper, searchBtn);
  } else {
    queryInputBar.append(queryInputWrapper, searchBtn);
    input.classList.add('rounded-box');
  }
  queryInputContainer.append(queryInputBar);

  block.textContent = '';
  block.append(queryInputContainer);
}
