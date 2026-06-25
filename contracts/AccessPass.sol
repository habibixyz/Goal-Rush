// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract GoalRushAccessPass is ERC721Enumerable, Ownable {
    using Strings for uint256;

    IERC20 public grushToken;
    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public mintPrice = 10 * 10**18; // 10 GRUSH (assuming 18 decimals)
    uint256 private _nextTokenId = 1;

    // The single image URL for all VIP passes
    string public imageUrl = "https://goalrush.fun/access-pass.png";

    event AccessPassMinted(address indexed minter, uint256 indexed tokenId);

    constructor(address _grushTokenAddress) ERC721("GoalRush Access Pass", "GR-VIP") Ownable(msg.sender) {
        grushToken = IERC20(_grushTokenAddress);
    }

    /**
     * @notice Mint an Access Pass by paying 10 GRUSH
     */
    function mint() external {
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");
        require(grushToken.transferFrom(msg.sender, address(this), mintPrice), "GRUSH transfer failed");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(msg.sender, tokenId);

        emit AccessPassMinted(msg.sender, tokenId);
    }

    /**
     * @notice Returns the dynamically generated base64 JSON metadata for the NFT.
     * All passes use the same VIP artwork.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        string memory json = string(
            abi.encodePacked(
                '{"name": "GoalRush VIP Access Pass #',
                tokenId.toString(),
                '", "description": "Guarantees exclusive gated access to VIP prediction pools and zero-fee token swaps on the GoalRush protocol.", "image": "',
                imageUrl,
                '", "attributes": [{"trait_type": "Tier", "value": "VIP Access"}, {"trait_type": "Supply", "value": "1000"}]}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    /**
     * @notice Admin function to withdraw accumulated GRUSH tokens
     */
    function withdrawGrush() external onlyOwner {
        uint256 balance = grushToken.balanceOf(address(this));
        require(grushToken.transfer(owner(), balance), "Withdraw failed");
    }

    /**
     * @notice Admin function to update the artwork URI if needed
     */
    function setImageUrl(string memory _newUrl) external onlyOwner {
        imageUrl = _newUrl;
    }

    /**
     * @notice Admin function to update the mint price
     */
    function setMintPrice(uint256 _newPrice) external onlyOwner {
        mintPrice = _newPrice;
    }
}
