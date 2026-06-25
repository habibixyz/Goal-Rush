import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Import
content = content.replace("import collectibleSolidityCode from '../contracts/GoalRushCollectible.sol?raw'", 
                          "import collectibleSolidityCode from '../contracts/AccessPass.sol?raw'")

# 2. Add state and CONSTANTS
state_search = "const [mintStatus, setMintStatus] = useState('')"
state_replace = "const [mintStatus, setMintStatus] = useState('')\n  const [accessPassSupply, setAccessPassSupply] = useState('0');\n  const ACCESS_PASS_ADDRESS = '0x0000000000000000000000000000000000000000'; // UPDATE ME AFTER DEPLOYMENT"
content = content.replace(state_search, state_replace)

# 3. Add fetchAccessPassSupply to the fetcher (find fetchRecentCards and inject before it)
fetcher_search = "const fetchRecentCards = useCallback(async () => {"
fetcher_replace = """const fetchAccessPassSupply = useCallback(async () => {
    try {
      if (!window.ethereum && !rpcProvider) return;
      const provider = window.ethereum ? new ethers.BrowserProvider(window.ethereum) : rpcProvider;
      if (ACCESS_PASS_ADDRESS !== '0x0000000000000000000000000000000000000000') {
        const accessPassAbi = ["function totalSupply() external view returns (uint256)"];
        const contract = new ethers.Contract(ACCESS_PASS_ADDRESS, accessPassAbi, provider);
        const supply = await contract.totalSupply();
        setAccessPassSupply(supply.toString());
      }
    } catch (e) {
      console.warn("Failed to fetch access pass supply", e);
    }
  }, [rpcProvider]);

  const fetchRecentCards = useCallback(async () => {"""
content = content.replace(fetcher_search, fetcher_replace)

# 4. Inject fetchAccessPassSupply() into the periodic useEffect
effect_search = "fetchRecentCards();\n      fetchNewsArticles();\n    }, 10000);"
effect_replace = "fetchRecentCards();\n      fetchNewsArticles();\n      fetchAccessPassSupply();\n    }, 10000);"
content = content.replace(effect_search, effect_replace)

# Also call it initially
initial_effect_search = "fetchNewsArticles();\n  }, [currentView, fetchNewsArticles]);"
initial_effect_replace = "fetchNewsArticles();\n    fetchAccessPassSupply();\n  }, [currentView, fetchNewsArticles, fetchAccessPassSupply]);"
content = content.replace(initial_effect_search, initial_effect_replace)

# 5. Create handleMintAccessPass
mint_logic = """const handleMintAccessPass = async () => {
    if (!walletConnected || !userAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    if (ACCESS_PASS_ADDRESS === '0x0000000000000000000000000000000000000000') {
      alert("Contract not deployed yet! Please wait for the admin to deploy the VIP Pass contract.");
      return;
    }
    
    setIsMintingCard(true); // Using same loading state variable
    setMintStatus('Checking GRUSH balance...');
    addLog(`[Mint VIP] Checking GRUSH balance for ${userAddress}...`);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const accessPassAbi = ["function mint() external"];
      const accessPassContract = new ethers.Contract(ACCESS_PASS_ADDRESS, accessPassAbi, signer);

      const tokenAbi = [
        "function balanceOf(address account) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)"
      ];
      const tokenContract = new ethers.Contract(GRUSH_TOKEN_ADDRESS, tokenAbi, signer);

      const balanceWei = await tokenContract.balanceOf(userAddress);
      const mintFeeWei = ethers.parseEther('10.0'); // 10 GRUSH fee

      if (balanceWei < mintFeeWei) {
        throw new Error("Insufficient GRUSH balance. You need at least 10 GRUSH to mint.");
      }

      setMintStatus('Checking token allowance...');
      const allowance = await tokenContract.allowance(userAddress, ACCESS_PASS_ADDRESS);
      if (allowance < mintFeeWei) {
        setMintStatus('Approving 10 GRUSH for the VIP contract...');
        addLog(`[Mint VIP] Approving GRUSH spend limit for NFT contract...`);
        const approveTx = await tokenContract.approve(ACCESS_PASS_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
        addLog(`[Mint VIP] GRUSH approved successfully!`);
      }

      setMintStatus('Confirming VIP Pass Mint Transaction in wallet...');
      const tx = await accessPassContract.mint();

      setMintStatus('Transaction submitted! Waiting for confirmation...');
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setMintStatus('Successfully minted VIP Access Pass!');
        addLog(`[Mint VIP] Success! TX: ${receipt.hash}`);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#9dff00', '#ffffff', '#000000']
        });
        fetchAccessPassSupply(); // Refresh supply
      } else {
        throw new Error("Transaction failed on-chain.");
      }
    } catch (err) {
      console.error(err);
      addLog(`[Mint VIP] Error: ${err.message || err}`);
      alert(`Minting failed: ${err.message || err}`);
    } finally {
      setIsMintingCard(false);
      setMintStatus('');
    }
  }

  // <REPLACE_ANCHOR>"""

# Find handleMintNFT and replace it completely
# Since handleMintNFT is large, we'll use regex to nuke it up to the next recognizable function.
pattern = re.compile(r'const handleMintNFT = async \(paymentMethod\) => \{.*?(?=\s*const handleDownloadCard = async \(\) => \{)', re.DOTALL)
content = pattern.sub(mint_logic, content)

# 6. Update UI
ui_supply_search = """<span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#fff' }}>1000 / 1000</span>"""
ui_supply_replace = """<span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#fff' }}>{accessPassSupply} / 1000</span>"""
content = content.replace(ui_supply_search, ui_supply_replace)

ui_btn_search = """onClick={() => {
                    if (!walletConnected) {
                      handleConnectWallet();
                      return;
                    }
                    alert('VIP Access Pass minting contract will be deployed shortly.');
                  }}"""
ui_btn_replace = """onClick={handleMintAccessPass} disabled={isMintingCard}"""
content = content.replace(ui_btn_search, ui_btn_replace)

btn_text_search = """<Award size={18} fill="currentColor" /> {walletConnected ? 'Mint Access Pass' : 'Connect to Mint'}"""
btn_text_replace = """<Award size={18} fill="currentColor" /> {isMintingCard ? 'Minting...' : walletConnected ? 'Mint Access Pass' : 'Connect to Mint'}"""
content = content.replace(btn_text_search, btn_text_replace)

mint_status_box = """{/* Mint Status Notification */}
                  {mintStatus && (
                    <div style={{
                      padding: '10px',
                      background: 'rgba(0, 229, 255, 0.05)',
                      border: '1px solid rgba(0, 229, 255, 0.15)',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--color-secondary)',
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      <div className="badge-dot" style={{ display: 'inline-block', marginRight: '6px', background: 'var(--color-secondary)', boxShadow: '0 0 6px var(--color-secondary)' }}></div>
                      {mintStatus}
                    </div>
                  )}"""

# We need to render the mint status block in the Access Pass area.
# In the previous step, I completely deleted the Mint Status Notification that was part of the Twitter Card block.
# I'll inject it just above the button.

btn_wrapper_search = """<button 
                  className="btn-primary\""""
btn_wrapper_replace = mint_status_box + "\n                <button \n                  className=\"btn-primary\""
content = content.replace(btn_wrapper_search, btn_wrapper_replace)

# Sandbox name update
sandbox_search = "GoalRushCollectible.sol"
sandbox_replace = "AccessPass.sol"
content = content.replace(sandbox_search, sandbox_replace)


with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated App.jsx with Access Pass logic.")
