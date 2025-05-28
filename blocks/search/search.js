const QUERY_TYPES = {
  ASSETS: 'Assets',
  COLLECTIONS: 'Collections',
}

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

  const select = document.createElement('select');
  select.className = 'query-type-select';
  // You will need to set the value and handle change events as needed
  const optionAssets = document.createElement('option');
  optionAssets.value = QUERY_TYPES.ASSETS;
  optionAssets.textContent = QUERY_TYPES.ASSETS;

  const optionCollections = document.createElement('option');
  optionCollections.value = QUERY_TYPES.COLLECTIONS;
  optionCollections.textContent = QUERY_TYPES.COLLECTIONS;

  select.append(optionAssets, optionCollections);
  queryDropdown.append(select);

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
  // Set value, event listeners, and autofocus as needed

  queryInputWrapper.append(querySearchIcon, input);

  const performSearch = () => {
    const query = input.value;
    const selectedQueryType = select.value;
    const url = `/tools/assets-browser/index.html?query=${query}&selectedQueryType=${selectedQueryType}`;
    window.location.href = url; // Open URL in the same tab
  }

  // Search button
  const searchBtn = document.createElement('button');
  searchBtn.className = 'query-search-btn';
  searchBtn.setAttribute('aria-label', 'Search');
  searchBtn.textContent = 'Search';
  // Add event listener to log input and selected option
  searchBtn.addEventListener('click', performSearch);
  // Add event listener to input for Enter key
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch(); // Perform search on Enter key
  });

  // Assemble everything
  queryInputBar.append(queryDropdown, queryInputWrapper, searchBtn);
  queryInputContainer.append(queryInputBar);

  // Now you can append queryInputContainer to your searchBlock or wherever needed
  block.textContent = '';
  block.append(queryInputContainer);
}
