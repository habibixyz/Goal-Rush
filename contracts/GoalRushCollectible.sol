// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract GoalRushCollectible {
    string public constant name = "GoalRush World Cup Collectibles";
    string public constant symbol = "GRUSH-NFT";

    // Mint prices
    uint256 public okbMintPrice = 0.002 ether; // 0.002 OKB (approx. $0.10)
    uint256 public grushMintPrice = 10 * 10**18; // 10 GRUSH

    address public owner;
    address public grushTokenAddress;
    uint256 public nextTokenId = 1;

    struct Card {
        string username;
        string pos;
        uint8 overall;
        uint8 defi_iq;
        uint8 prediction_power;
        uint8 jackpot_luck;
        uint8 degen_level;
        uint8 swap_speed;
        uint8 x_factor;
        string card_type; // bronze, silver, gold, diamond, legendary
        uint256 mintTime;
    }

    mapping(uint256 => Card) public cards;
    mapping(uint256 => string) private _tokenURIs;

    // ERC721 Mappings
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // ERC721 Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event CardMinted(address indexed minter, uint256 indexed tokenId, string username, string card_type);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _grushToken) {
        owner = msg.sender;
        grushTokenAddress = _grushToken;
    }

    // Mint using native OKB
    function mintWithOKB(
        string memory username,
        string memory pos,
        uint8 overall,
        uint8 defi_iq,
        uint8 prediction_power,
        uint8 jackpot_luck,
        uint8 degen_level,
        uint8 swap_speed,
        uint8 x_factor,
        string memory card_type,
        string memory uri
    ) external payable returns (uint256) {
        require(msg.value >= okbMintPrice, "Insufficient OKB payment");

        uint256 tokenId = nextTokenId++;
        _mint(msg.sender, tokenId);

        cards[tokenId] = Card({
            username: username,
            pos: pos,
            overall: overall,
            defi_iq: defi_iq,
            prediction_power: prediction_power,
            jackpot_luck: jackpot_luck,
            degen_level: degen_level,
            swap_speed: swap_speed,
            x_factor: x_factor,
            card_type: card_type,
            mintTime: block.timestamp
        });

        _tokenURIs[tokenId] = uri;

        emit CardMinted(msg.sender, tokenId, username, card_type);
        return tokenId;
    }

    // Mint using GRUSH utility tokens
    function mintWithGrush(
        string memory username,
        string memory pos,
        uint8 overall,
        uint8 defi_iq,
        uint8 prediction_power,
        uint8 jackpot_luck,
        uint8 degen_level,
        uint8 swap_speed,
        uint8 x_factor,
        string memory card_type,
        string memory uri
    ) external returns (uint256) {
        require(grushTokenAddress != address(0), "GRUSH address not configured");
        bool success = IERC20(grushTokenAddress).transferFrom(msg.sender, owner, grushMintPrice);
        require(success, "GRUSH transfer failed");

        uint256 tokenId = nextTokenId++;
        _mint(msg.sender, tokenId);

        cards[tokenId] = Card({
            username: username,
            pos: pos,
            overall: overall,
            defi_iq: defi_iq,
            prediction_power: prediction_power,
            jackpot_luck: jackpot_luck,
            degen_level: degen_level,
            swap_speed: swap_speed,
            x_factor: x_factor,
            card_type: card_type,
            mintTime: block.timestamp
        });

        _tokenURIs[tokenId] = uri;

        emit CardMinted(msg.sender, tokenId, username, card_type);
        return tokenId;
    }

    // Withdraw accumulated OKB mint fees
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    // Configuration setters
    function setPrices(uint256 _okbPrice, uint256 _grushPrice) external onlyOwner {
        okbMintPrice = _okbPrice;
        grushMintPrice = _grushPrice;
    }

    function setGrushToken(address _grushToken) external onlyOwner {
        grushTokenAddress = _grushToken;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    // ERC721 Standard Read-only methods
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenURIs[tokenId];
    }

    function balanceOf(address account) external view returns (uint256) {
        require(account != address(0), "Zero address balance");
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        return tokenOwner;
    }

    // ERC721 Approvals and Transfers
    function getApproved(uint256 tokenId) external view returns (address) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address tokenOwner, address operator) public view returns (bool) {
        return _operatorApprovals[tokenOwner][operator];
    }

    // Support approvals
    function approve(address to, uint256 tokenId) external {
        address tokenOwner = _owners[tokenId];
        require(msg.sender == tokenOwner || isApprovedForAll(tokenOwner, msg.sender), "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        require(from == tokenOwner, "Transfer from incorrect owner");
        require(to != address(0), "Transfer to zero address");

        require(
            msg.sender == tokenOwner ||
            _tokenApprovals[tokenId] == msg.sender ||
            isApprovedForAll(tokenOwner, msg.sender),
            "Not approved or owner"
        );

        _tokenApprovals[tokenId] = address(0);
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata /*data*/) external {
        transferFrom(from, to, tokenId);
    }

    function getCard(uint256 tokenId) external view returns (Card memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return cards[tokenId];
    }

    // Helper functions
    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "Mint to zero address");
        require(_owners[tokenId] == address(0), "Token already minted");

        _owners[tokenId] = to;
        _balances[to] += 1;

        emit Transfer(address(0), to, tokenId);
    }

    // Support interfaces
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || // ERC165
               interfaceId == 0x80ac58cd || // ERC721
               interfaceId == 0x5b5e139f;   // ERC721Metadata
    }
}
