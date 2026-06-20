import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { io } from 'socket.io-client'
import { ethers } from 'ethers'
import confetti from 'canvas-confetti'
import goalRushLogo from './assets/logo.png'
import SoccerBall3D from './components/SoccerBall3D'
import currentHookSolidityCode from '../contracts/WorldCupGoalRushHook.sol?raw'
import {
  Coins,
  Terminal as TerminalIcon,
  Award,
  Code,
  Cpu,
  Play,
  HelpCircle,
  CheckCircle,
  Copy,
  ChevronRight,
  ExternalLink,
  Flame,
  User,
  ShieldCheck,
  AlertTriangle,
  LogOut,
  X,
  Plus,
  Twitter,
  Send,
  Globe,
  Activity
} from 'lucide-react'

// Real codebase strings to display in Code Viewer
const hookSolidityCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WorldCupGoalRushHook
 * @notice A Uniswap V4 Hook designed for the OKX X Layer "Hook the World Cup" Hackathon.
 * It integrates a World Cup Match Prediction Jackpot and a gamified "Goal Rush" swap rebate.
 * 
 * Features:
 * 1. World Cup Jackpot: A percentage of each swap fee is sent to a jackpot pool. Users can
 *    predict the winner of the active World Cup match via \`hookData\`. Correct predictions
 *    share the jackpot when the match is resolved.
 * 2. Goal Rush Rebate: Swaps have a random chance (e.g., 5%) to score a "Goal", which triggers
 *    an immediate fee rebate or cashback reward from the pool.
 */

interface IPoolManager {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
}

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct BeforeSwapDelta {
    int128 delta0;
    int128 delta1;
}

contract WorldCupGoalRushHook {
    // --- Uniswap V4 Hooks Standards ---
    address public immutable poolManager;

    modifier onlyPoolManager() {
        require(msg.sender == poolManager, "Only PoolManager");
        _;
    }

    // --- World Cup State ---
    struct Match {
        uint256 id;
        string teamA;
        string teamB;
        uint256 startTime;
        uint256 endTime;
        bool resolved;
        uint8 winner; // 0 = None/Draw, 1 = TeamA, 2 = TeamB
        uint256 totalJackpot;
        uint256 totalPredictionVolume;
    }

    struct Prediction {
        uint8 predictedTeam; // 1 = TeamA, 2 = TeamB
        uint256 amount;
        bool claimed;
    }

    address public owner;
    uint256 public activeMatchId;
    mapping(uint256 => Match) public matches;
    // matchId => user => Prediction
    mapping(uint256 => mapping(address => Prediction)) public predictions;
    // matchId => teamId => total prediction volume
    mapping(uint256 => mapping(uint8 => uint256)) public teamPredictionVolume;

    // --- Gamified Goal Rush State ---
    uint256 public goalRushChance = 5; // 5% chance
    uint256 public totalGoalsScored;
    mapping(address => uint256) public userGoals;
    
    // --- Events ---
    event MatchCreated(uint256 indexed matchId, string teamA, string teamB, uint256 startTime);
    event MatchResolved(uint256 indexed matchId, uint8 winner, uint256 jackpotAmount);
    event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume);
    event GoalScored(address indexed swapper, uint256 bonusAmount);
    event JackpotClaimed(address indexed user, uint256 indexed matchId, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner");
        _;
    }

    constructor(address _poolManager) {
        poolManager = _poolManager;
        owner = msg.sender;
    }

    // --- Uniswap V4 Callbacks ---

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta memory, uint24) {
        if (hookData.length > 0 && activeMatchId > 0) {
            Match storage activeMatch = matches[activeMatchId];
            if (!activeMatch.resolved && block.timestamp < activeMatch.endTime) {
                (uint8 predictedTeam, address swapper) = abi.decode(hookData, (uint8, address));
                
                if (predictedTeam == 1 || predictedTeam == 2) {
                    uint256 swapAmount = params.amountSpecified > 0 
                        ? uint256(params.amountSpecified) 
                        : uint256(-params.amountSpecified);

                    Prediction storage pred = predictions[activeMatchId][swapper];
                    pred.predictedTeam = predictedTeam;
                    pred.amount += swapAmount;

                    teamPredictionVolume[activeMatchId][predictedTeam] += swapAmount;
                    activeMatch.totalPredictionVolume += swapAmount;

                    uint256 jackpotContribution = swapAmount / 1000;
                    activeMatch.totalJackpot += jackpotContribution;

                    emit PredictionPlaced(swapper, activeMatchId, predictedTeam, swapAmount);
                }
            }
        }
        return (this.beforeSwap.selector, BeforeSwapDelta(0, 0), 0);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        int128 delta0,
        int128 delta1,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, int128) {
        uint256 randVal = uint256(keccak256(abi.encodePacked(
            block.timestamp, 
            sender, 
            delta0, 
            delta1
        ))) % 100;

        if (randVal < goalRushChance) {
            address swapper = sender;
            if (hookData.length > 0) {
                (, swapper) = abi.decode(hookData, (uint8, address));
            }
            
            totalGoalsScored++;
            userGoals[swapper]++;

            emit GoalScored(swapper, 10000000000000000); // 0.01 OKB rebate reward
        }

        return (this.afterSwap.selector, 0);
    }

    // --- World Cup Admin Functions ---

    function createMatch(
        uint256 _matchId,
        string calldata _teamA,
        string calldata _teamB,
        uint256 _duration
    ) external onlyOwner {
        require(matches[_matchId].id == 0, "Match already exists");
        
        matches[_matchId] = Match({
            id: _matchId,
            teamA: _teamA,
            teamB: _teamB,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            resolved: false,
            winner: 0,
            totalJackpot: 0,
            totalPredictionVolume: 0
        });

        activeMatchId = _matchId;
        emit MatchCreated(_matchId, _teamA, _teamB, block.timestamp);
    }

    function resolveMatch(uint256 _matchId, uint8 _winner) external onlyOwner {
        Match storage targetMatch = matches[_matchId];
        require(targetMatch.id != 0, "Match does not exist");
        require(!targetMatch.resolved, "Match already resolved");
        require(_winner <= 2, "Invalid winner");

        targetMatch.resolved = true;
        targetMatch.winner = _winner;

        emit MatchResolved(_matchId, _winner, targetMatch.totalJackpot);
    }

    // --- User Claim Functions ---

    function claimJackpot(uint256 _matchId) external {
        Match storage targetMatch = matches[_matchId];
        require(targetMatch.resolved, "Match not resolved yet");
        
        Prediction storage pred = predictions[_matchId][msg.sender];
        require(pred.amount > 0, "No prediction made");
        require(!pred.claimed, "Jackpot already claimed");
        require(pred.predictedTeam == targetMatch.winner, "Prediction was incorrect");

        pred.claimed = true;

        uint256 winnerVolume = teamPredictionVolume[_matchId][targetMatch.winner];
        uint256 claimAmount = (pred.amount * targetMatch.totalJackpot) / winnerVolume;

        (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
        require(success, "Jackpot transfer failed");

        emit JackpotClaimed(msg.sender, _matchId, claimAmount);
    }

    // --- Native OKB Deposits and Admin Management ---

    receive() external payable {}

    function withdraw(uint256 amount) external onlyOwner {
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdraw transfer failed");
    }

    // --- Configuration ---

    function setGoalRushChance(uint256 _chance) external onlyOwner {
        require(_chance <= 100, "Chance too high");
        goalRushChance = _chance;
    }
}`;

const mockManagerCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WorldCupGoalRushHook} from "../WorldCupGoalRushHook.sol";

contract MockPoolManager {
    event SwapTriggered(
        address indexed hook,
        address indexed sender,
        bool zeroForOne,
        int256 amountSpecified,
        bytes hookData
    );

    function executeMockSwap(
        address hookAddress,
        address swapper,
        bool zeroForOne,
        int256 amountSpecified,
        bytes calldata hookData
    ) external returns (bytes4, bytes4) {
        WorldCupGoalRushHook hook = WorldCupGoalRushHook(payable(hookAddress));
        
        PoolKey memory key = PoolKey({
            currency0: address(0),
            currency1: address(0),
            fee: 3000,
            tickSpacing: 60,
            hooks: hookAddress
        });

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: 0
        });

        (bytes4 beforeSelector, , ) = hook.beforeSwap(
            swapper,
            key,
            params,
            hookData
        );

        (bytes4 afterSelector, ) = hook.afterSwap(
            swapper,
            key,
            params,
            0,
            0,
            hookData
        );

        emit SwapTriggered(hookAddress, swapper, zeroForOne, amountSpecified, hookData);

        return (beforeSelector, afterSelector);
    }
}`;

const deployScriptCode = `// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // PoolManager and CREATE2 Deployer addresses on X Layer Mainnet
  const poolManagerAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const deployerAddress = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
  const salt = process.argv[4]; // Mined salt matching BEFORE_SWAP and AFTER_SWAP flags

  const GoalRushHook = await ethers.getContractFactory("WorldCupGoalRushHook");
  const bytecode = GoalRushHook.bytecode;
  const abiCoder = new ethers.AbiCoder();
  const constructorArgs = abiCoder.encode(["address"], [poolManagerAddress]);
  const creationCode = ethers.concat([bytecode, constructorArgs]);

  console.log("Sending deployment transaction to CREATE2 Factory...");
  const tx = await deployer.sendTransaction({
    to: deployerAddress,
    data: ethers.concat([salt, creationCode]),
  });

  await tx.wait();
  console.log("Successfully deployed contract via CREATE2!");
}`;

const readmeMarkdown = `# GoalRush — World Cup Uniswap V4 Hook

GoalRush is a gamified Uniswap V4 hook custom-built for the OKX X Layer "Hook the World Cup" Hackathon.

## Features
1. **World Cup Prediction Jackpot**: Diverts 0.1% of swap volume to a match winner jackpot pool.
2. **Goal Rush Rebate**: 5% chance on swap to score a "Goal", awarding an immediate 0.01 OKB fee rebate.
3. **CREATE2 Mined Address**: Optimized address mining to satisfy Uniswap V4 hook permission flags.

## Eulr.fun Hackathon Integration (Qualify for $200K USDT)
1. **Deploy Hook**: Deploy \`WorldCupGoalRushHook\` to X Layer Mainnet.
2. **Launch Token**: Go to Eulr.fun on X Layer, create a token, and paste your hook address.
3. **Graduate**: Reach the bonding curve cap. Eulr.fun automatically initializes the Uniswap V4 pool with your hook.
4. **Drive Volume**: All swaps on the graduated pool run through your hook. Trade via OKX Wallet to rank!
`;

const asciiArtText = `
                                         #IF-28082006-FFFFFFFF - BLOCK_LINDY - 3835388 - OR-CHECKSIZE_BLOCK...
                                   #00000000000000000000 - HAS-MEM-INJECTOR-283 - BLOCK_CHECKER_TEST...
                              #INDEX-10293882 - BLOCK.NUM - 820388 - BLOCK.WITHDRAW - FEE_REBATE...
                           #beforeSwap() - hookData - prediction[user] - activeMatchId[1] - winner...
                        #afterSwap() - scoreGoal - penaltyRebate - okbBonus - msg.sender - gasLimit...
                     #Eulr.fun - graduationPool - UniswapV4Pool - XLayerMainnet - 0x360e68faccca...
                   #196 - OKX_Wallet - TradeVolume - $200K_USDT - prizePool - ranking - scoreGoal...
                 #WorldCupGoalRushHook - 0xb4f86ecb09BE... - poolManager...
               #CREATE2Deployer - mineSalt() - 0x4e59b44847b379578588920cA78FbF26c0B4956C - flags...
             #MockPoolManager - executeMockSwap() - SwapTriggered() - zeroForOne - amountSpecified...
            #totalGoalsScored - userGoals[swapper] - goalRushChance[5%] - rewardAmount[0.01_OKB]...
           #jackpotPool - teamPredictionVolume - claimJackpot() - rewardAmount - transferSuccess...
          #matchCreated - matchResolved - winnerId - teamA[Argentina] - teamB[France] - scoreCount...
         #UniswapV4 - beforeSwap.selector - BeforeSwapDelta - afterSwap.selector - bytes32...
        #block.timestamp - block.prevrandao - msg.sender - abi.encodePacked - keccak256 - entropy...
       #address0 - address1 - fee[3000] - tickSpacing[60] - hooks - swapParams - zeroForOne...
      #IPoolManager - SwapParams - amountSpecified - sqrtPriceLimitX96 - beforeSwapDelta...
      #eventMatchCreated - eventMatchResolved - eventPredictionPlaced - eventGoalScored...
      #eventJackpotClaimed - modifierOnlyOwner - modifierOnlyPoolManager - requireState...
      #createMatch() - resolveMatch() - withdraw() - setGoalRushChance() - receive() - fallback...
      #activeMatch.resolved - activeMatch.endTime - activeMatch.totalJackpot - activeMatch...
      #PredictionPlaced - GoalScored - JackpotClaimed - MatchCreated - MatchResolved...
      #abi.decode - predictedTeam - swapper - swapAmount - jackpotContribution - teamVolume...
      #keccak256 - abi.encodePacked - block.timestamp - sender - delta0 - delta1 - goalRush...
      #uint256 - string - mapping - address - bool - uint8 - bytes - constructorArgs...
      #PoolKey - currency0 - currency1 - fee - tickSpacing - hooks - beforeSwapDelta...
      #zeroForOne - amountSpecified - sqrtPriceLimitX96 - beforeSwap - afterSwap...
      #executeMockSwap - MockPoolManager - SwapTriggered - WorldCupGoalRushHook...
      #deployer - Signers - poolManagerAddress - deployerAddress - salt - bytecode...
      #CREATE2 - Factory - tx.wait() - successfullyDeployedContract - hardhat...
      #GoalRush - WorldCupUniswapV4Hook - XLayer - hackathon - OKX_Wallet...
      #bondingCurve - capReached - graduate - realTrading - liquidityMoves...
      #activeMatch.resolved - activeMatch.endTime - activeMatch.totalJackpot - activeMatch...
      #PredictionPlaced - GoalScored - JackpotClaimed - MatchCreated - MatchResolved...
      #abi.decode - predictedTeam - swapper - swapAmount - jackpotContribution - teamVolume...
      #keccak256 - abi.encodePacked - block.timestamp - sender - delta0 - delta1 - goalRush...
      #uint256 - string - mapping - address - bool - uint8 - bytes - constructorArgs...
      #PoolKey - currency0 - currency1 - fee - tickSpacing - hooks - beforeSwapDelta...
      #zeroForOne - amountSpecified - sqrtPriceLimitX96 - beforeSwap - afterSwap...
      #executeMockSwap - MockPoolManager - SwapTriggered - WorldCupGoalRushHook...
      #deployer - Signers - poolManagerAddress - deployerAddress - salt - bytecode...
      #CREATE2 - Factory - tx.wait() - successfullyDeployedContract - hardhat...
      #GoalRush - WorldCupUniswapV4Hook - XLayer - hackathon - OKX_Wallet...
      #bondingCurve - capReached - graduate - realTrading - liquidityMoves...
                        #afterSwap() - scoreGoal - penaltyRebate - okbBonus - msg.sender - gasLimit...
                     #Eulr.fun - graduationPool - UniswapV4Pool - XLayerMainnet - 0x360e68faccca...
                   #196 - OKX_Wallet - TradeVolume - $200K_USDT - prizePool - ranking - scoreGoal...
                 #WorldCupGoalRushHook - 0xb4f86ecb09BE... - poolManager...
               #CREATE2Deployer - mineSalt() - 0x4e59b44847b379578588920cA78FbF26c0B4956C - flags...
             #MockPoolManager - executeMockSwap() - SwapTriggered() - zeroForOne - amountSpecified...
            #totalGoalsScored - userGoals[swapper] - goalRushChance[5%] - rewardAmount[0.01_OKB]...
           #jackpotPool - teamPredictionVolume - claimJackpot() - rewardAmount - transferSuccess...
          #matchCreated - matchResolved - winnerId - teamA[Argentina] - teamB[France] - scoreCount...
         #UniswapV4 - beforeSwap.selector - BeforeSwapDelta - afterSwap.selector - bytes32...
        #block.timestamp - block.prevrandao - msg.sender - abi.encodePacked - keccak256 - entropy...
`;

const getFlagUrl = (fifaCode) => {
  if (fifaCode && (fifaCode.startsWith('http://') || fifaCode.startsWith('https://'))) {
    return fifaCode;
  }
  const fifaToIso = {
    QAT: 'qa', ECU: 'ec', ENG: 'gb-eng', IRN: 'ir', SEN: 'sn', NED: 'nl',
    USA: 'us', WAL: 'gb-wls', ARG: 'ar', KSA: 'sa', DEN: 'dk', TUN: 'tn',
    MEX: 'mx', POL: 'pl', FRA: 'fr', AUS: 'au', MAR: 'ma', CRO: 'hr',
    GER: 'de', JPN: 'jp', ESP: 'es', CRC: 'cr', BEL: 'be', CAN: 'ca',
    SUI: 'ch', CMR: 'cm', URU: 'uy', KOR: 'kr', POR: 'pt', GHA: 'gh',
    SRB: 'rs', BRA: 'br', ITA: 'it', SCO: 'gb-sct',
    BIH: 'ba', PAR: 'py', RSA: 'za', CZE: 'cz', HAI: 'ht', CUW: 'cw',
    NZL: 'nz', EGY: 'eg', CPV: 'cv'
  };
  const iso = fifaToIso[fifaCode?.toUpperCase()] || 'un';
  return `https://flagcdn.com/w40/${iso}.png`;
};

const getTeamFifaCode = (name) => {
  const mapping = {
    'argentina': 'ARG',
    'france': 'FRA',
    'canada': 'CAN',
    'united states': 'USA',
    'mexico': 'MEX',
    'brazil': 'BRA',
    'spain': 'ESP',
    'germany': 'GER',
    'england': 'ENG',
    'italy': 'ITA',
    'portugal': 'POR',
    'croatia': 'CRO',
    'netherlands': 'NED',
    'belgium': 'BEL',
    'japan': 'JPN',
    'korea': 'KOR',
    'korea republic': 'KOR',
    'switzerland': 'SUI',
    'morocco': 'MAR',
    'qatar': 'QAT',
    'ecuador': 'ECU',
    'iran': 'IRN',
    'senegal': 'SEN',
    'wales': 'WAL',
    'saudi arabia': 'KSA',
    'denmark': 'DEN',
    'tunisia': 'TUN',
    'poland': 'POL',
    'australia': 'AUS',
    'costa rica': 'CRC',
    'cameroon': 'CMR',
    'uruguay': 'URU',
    'ghana': 'GHA',
    'serbia': 'SRB',
    'scotland': 'SCO',
    'bosnia & herzegovina': 'BIH',
    'paraguay': 'PAR',
    'south africa': 'RSA',
    'czechia': 'CZE',
    'haiti': 'HAI',
    'curacao': 'CUW',
    'new zealand': 'NZL',
    'egypt': 'EGY',
    'cape verde': 'CPV',
    'dr congo': 'COD',
    'jordan': 'JOR',
    'austria': 'AUT',
    'panama': 'PAN',
    'uzbekistan': 'UZB',
    'colombia': 'COL',
    'south korea': 'KOR',
    'slovakia': 'SVK',
    'turkey': 'TUR',
    'iraq': 'IRQ',
    'norway': 'NOR',
    'algeria': 'ALG'
  };
  return mapping[name?.toLowerCase().trim()] || 'UN';
};

const getCleanAbbreviation = (teamName, flagCode) => {
  if (flagCode && flagCode !== 'UN' && !flagCode.startsWith('http')) {
    return flagCode;
  }
  const code = getTeamFifaCode(teamName);
  if (code && code !== 'UN') {
    return code;
  }
  return teamName?.slice(0, 3).toUpperCase() || 'UN';
};


// Helper to get the correct OKX Wallet provider strictly
const getProvider = () => {
  if (typeof window !== 'undefined') {
    // 1. Check direct okxwallet injector
    if (window.okxwallet) return window.okxwallet;

    // 2. Check if window.ethereum is OKX Wallet
    if (window.ethereum) {
      if (window.ethereum.isOKXWallet) return window.ethereum;

      // 3. Handle multi-provider injection setups (e.g. OKX + MetaMask coexistence)
      if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
        const okx = window.ethereum.providers.find(p => p.isOKXWallet);
        if (okx) return okx;
      }
    }
  }
  return null;
};

const HOOK_ADDRESS = '0x700656337a252A004Ca0B170828f4adEaa680288';
const ROUTER_ADDRESS = '0x8f3e9B45a377cEa9fCeC9509e82EEe237e67ba24';
const GRUSH_TOKEN_ADDRESS = '0x422fe165b2da990d18c6dca944b11dcd61519671';

// Helper to get today/tomorrow date strings dynamically
const getTodayLabel = () => {
  const d = new Date();
  return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getDate()}`;
};
const getTomorrowLabel = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getDate()}`;
};
const TODAY_LABEL = getTodayLabel();
const TOMORROW_LABEL = getTomorrowLabel();

export default function App() {
  const getNumericMatchId = (matchId) => {
    if (!matchId) return 0n;
    if (typeof matchId === 'bigint') return matchId;
    if (typeof matchId === 'number') return BigInt(matchId);
    const s = String(matchId);
    if (/^\d+$/.test(s)) return BigInt(s);
    return BigInt(ethers.id(s));
  };

  const parseRevertReason = (err) => {
    if (!err) return '';
    if (err.reason) return err.reason;
    const msg = err.message || String(err);
    if (msg.includes("Predictions closed")) return "Predictions are closed for this match.";
    if (msg.includes("Match already resolved")) return "This match has already been resolved.";
    if (msg.includes("No active match")) return "There is currently no active match.";
    if (msg.includes("insufficient funds")) return "Insufficient balance in your wallet to cover the transaction value and gas fees.";
    if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED") || err.code === 4001) return "Transaction cancelled in your wallet.";
    const matchReason = msg.match(/reverted with reason string ['"]([^'"]+)['"]/);
    if (matchReason && matchReason[1]) return matchReason[1];
    const matchRevert = msg.match(/execution reverted:? ([^"\n]+)/);
    if (matchRevert && matchRevert[1]) return matchRevert[1].trim();
    const matchGenericRevert = msg.match(/revert:? ([^"\n]+)/i);
    if (matchGenericRevert && matchGenericRevert[1]) return matchGenericRevert[1].trim();
    return '';
  };

  const [onChainActiveId, setOnChainActiveId] = useState(0n);
  const [isSelectedMatchOnChain, setIsSelectedMatchOnChain] = useState(false);

  const [activeMatch, setActiveMatch] = useState({
    id: 10,
    teamA: 'Netherlands',
    teamB: 'Japan',
    flagA: 'NED',
    flagB: 'JPN',
    resolved: false,
    winner: 0,
    isLive: true,
    minute: "1'"
  });

  const activeMatchRef = useRef(activeMatch);
  const socketRef = useRef(null);
  const liveMatchesRef = useRef([]);
  const hasInitializedRef = useRef(false);
  const statsCacheRef = useRef({});
  const leaderboardScannedRef = useRef(false); // Track if we have done a full historical scan
  const hasInitializedLeaderboardRef = useRef(false); // Track if we started the historical scan
  const lastFetchedBlockRef = useRef(62494373); // Start from first contract deployment block
  const activeOnChainMatchRef = useRef({ id: 1, teamA: 'Canada', teamB: 'Bosnia & Herzegovina' });

  useEffect(() => {
    activeMatchRef.current = activeMatch;
  }, [activeMatch]);

  const [matchId, setMatchId] = useState(1)
  const [prediction, setPrediction] = useState(1) // 1 = Argentina, 2 = France
  const [swapAmount, setSwapAmount] = useState('0.001')
  const [selectedToken, setSelectedToken] = useState('OKB')
  const [jackpot, setJackpot] = useState(0)
  const [grushJackpot, setGrushJackpot] = useState(0)
  const [teamAVotes, setTeamAVotes] = useState(0) // Argentina volume OKB
  const [teamBVotes, setTeamBVotes] = useState(0) // France volume OKB
  const [teamDrawVotes, setTeamDrawVotes] = useState(0) // Draw volume OKB
  const [teamAGrushVotes, setTeamAGrushVotes] = useState(0)
  const [teamBGrushVotes, setTeamBGrushVotes] = useState(0)
  const [teamDrawGrushVotes, setTeamDrawGrushVotes] = useState(0)
  const [activeTab, setActiveTab] = useState('hook') // hook, mock, deploy, readme
  const [showDevPortal, setShowDevPortal] = useState(false)
  const [showWhitepaper, setShowWhitepaper] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [activeRightTab, setActiveRightTab] = useState('match') // match or scores
  const [shootoutStatus, setShootoutStatus] = useState('')
  const [currentView, setCurrentView] = useState('dashboard') // dashboard or match-center
  const [selectedMatchCenterId, setSelectedMatchCenterId] = useState(10)
  const [matchFilter, setMatchFilter] = useState('all')
  const [matchCenterSubTab, setMatchCenterSubTab] = useState('lineup')

  const getMatchStats = (m) => {
    const seed = m.id;
    const possessionA = 40 + (seed % 21);
    const possessionB = 100 - possessionA;
    const shotsA = 5 + (seed % 12);
    const shotsB = 5 + ((seed * 3) % 12);
    const targetA = Math.max(1, Math.round(shotsA * 0.4));
    const targetB = Math.max(1, Math.round(shotsB * 0.4));
    const cornersA = 2 + (seed % 6);
    const cornersB = 2 + ((seed * 2) % 6);
    const foulsA = 8 + (seed % 8);
    const foulsB = 8 + ((seed * 3) % 8);
    const yellowA = seed % 3;
    const yellowB = (seed * 2) % 3;

    return {
      possession: [possessionA, possessionB],
      shots: [shotsA, shotsB],
      shotsOnTarget: [targetA, targetB],
      corners: [cornersA, cornersB],
      fouls: [foulsA, foulsB],
      yellowCards: [yellowA, yellowB]
    };
  };

  const getLineups = (teamAName, teamBName) => {
    const getRoster = (teamName) => {
      const name = teamName?.toLowerCase() || '';
      if (name.includes('canada')) {
        return ['M. Crépeau', 'A. Johnston', 'K. Miller', 'D. Cornelius', 'A. Davies', 'I. Koné', 'S. Eustáquio', 'T. Buchanan', 'J. David', 'C. Larin', 'L. Millar'];
      }
      if (name.includes('bosnia')) {
        return ['I. Šehić', 'A. Dedić', 'D. Hadžikadunić', 'S. Kolašinac', 'J. Gazibegović', 'M. Krunić', 'B. Tahirović', 'D. Huseinbašić', 'E. Džeko', 'E. Demirović', 'H. Hajradinović'];
      }
      if (name.includes('united states') || name.includes('usa')) {
        return ['M. Turner', 'J. Scally', 'C. Richards', 'T. Ream', 'A. Robinson', 'W. McKennie', 'Y. Musah', 'T. Adams', 'T. Weah', 'F. Balogun', 'C. Pulisic'];
      }
      if (name.includes('paraguay')) {
        return ['R. Fernández', 'G. Gómez', 'F. Balbuena', 'O. Alderete', 'M. Almirón', 'A. Cubas', 'D. Gómez', 'R. Sosa', 'A. Sanabria', 'J. Enciso', 'A. Romero'];
      }
      if (name.includes('brazil')) {
        return ['Ederson', 'Danilo', 'Marquinhos', 'Gabriel', 'W. Lodi', 'Casemiro', 'B. Guimarães', 'L. Paquetá', 'Raphinha', 'Rodrygo', 'Vinícius Jr.'];
      }
      if (name.includes('morocco')) {
        return ['Y. Bounou', 'A. Hakimi', 'N. Aguerd', 'R. Saïss', 'N. Mazraoui', 'S. Amrabat', 'A. Ounahi', 'I. Chair', 'H. Ziyech', 'Y. En-Nesyri', 'S. Boufal'];
      }
      if (name.includes('qatar')) {
        return ['M. Barsham', 'P. Miguel', 'B. Khoukhi', 'T. Salman', 'H. Ahmed', 'A. Hatem', 'K. Boudiaf', 'H. Al-Haydos', 'A. Afif', 'A. Ali', 'M. Muntari'];
      }
      if (name.includes('switzerland')) {
        return ['Y. Sommer', 'S. Widmer', 'M. Akanji', 'N. Elvedi', 'R. Rodriguez', 'R. Freuler', 'G. Xhaka', 'D. Sow', 'X. Shaqiri', 'B. Embolo', 'R. Vargas'];
      }
      if (name.includes('haiti')) {
        return ['J. Placide', 'C. Arcus', 'R. Adé', 'A. Christian', 'W. Guerrier', 'B. Alceus', 'C. Sainte', 'D. Nazon', 'F. Frantzdy', 'D. Etienne', 'M. Antoine'];
      }
      if (name.includes('scotland')) {
        return ['A. Gunn', 'A. Hickey', 'R. Porteous', 'J. Hendry', 'K. Tierney', 'A. Robertson', 'S. McTominay', 'B. Gilmour', 'C. McGregor', 'J. McGinn', 'L. Shankland'];
      }
      if (name.includes('argentina')) {
        return ['E. Martínez', 'N. Molina', 'C. Romero', 'N. Otamendi', 'N. Tagliafico', 'R. De Paul', 'E. Fernández', 'A. Mac Allister', 'L. Messi', 'J. Álvarez', 'A. Di María'];
      }
      if (name.includes('türkiye') || name.includes('turkey')) {
        return ['U. Çakır', 'Z. Çelik', 'M. Demiral', 'A. Bardakcı', 'F. Kadıoğlu', 'H. Çalhanoğlu', 'S. Özcan', 'K. Kökçü', 'C. Ünder', 'C. Tosun', 'K. Aktürkoğlu'];
      }
      if (name.includes('germany')) {
        return ['M. Neuer', 'J. Kimmich', 'A. Rüdiger', 'J. Tah', 'M. Mittelstädt', 'R. Andrich', 'T. Kroos', 'I. Gündoğan', 'J. Musiala', 'F. Wirtz', 'K. Havertz'];
      }
      if (name.includes('curacao')) {
        return ['E. Room', 'J. Gaari', 'C. Martina', 'R. Martina', 'S. Floranus', 'V. Anita', 'L. Bacuna', 'J. Bacuna', 'K. Felida', 'R. Janga', 'G. Kastaneer'];
      }
      if (name.includes('sweden')) {
        return ['R. Olsen', 'E. Krafth', 'V. Lindelöf', 'I. Hien', 'L. Augustinsson', 'J. Cajuste', 'H. Larsson', 'E. Forsberg', 'D. Kulusevski', 'A. Isak', 'V. Gyökeres'];
      }
      if (name.includes('colombia')) {
        return ['C. Vargas', 'D. Muñoz', 'D. Sánchez', 'J. Lucumí', 'J. Mojica', 'J. Lerma', 'R. Ríos', 'J. Arias', 'J. Rodríguez', 'L. Díaz', 'R. Borré'];
      }
      const positions = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'];
      const commonSurnames = ['Smith', 'Silva', 'Jones', 'Garcia', 'Martinez', 'Rodriguez', 'Miller', 'Davis', 'Lopez', 'Hernandez', 'Gonzalez'];
      return positions.map((pos, idx) => {
        const charCodeSum = teamName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const index = (charCodeSum + idx * 7) % commonSurnames.length;
        const initial = String.fromCharCode(65 + ((charCodeSum + idx) % 26));
        return initial + '. ' + commonSurnames[index];
      });
    };

    const squadA = getRoster(teamAName);
    const squadB = getRoster(teamBName);

    const coordsA = [
      { pos: 'GK', x: 50, y: 8 },
      { pos: 'DF', x: 20, y: 22 },
      { pos: 'DF', x: 40, y: 20 },
      { pos: 'DF', x: 60, y: 20 },
      { pos: 'DF', x: 80, y: 22 },
      { pos: 'MF', x: 30, y: 35 },
      { pos: 'MF', x: 50, y: 33 },
      { pos: 'MF', x: 70, y: 35 },
      { pos: 'FW', x: 20, y: 45 },
      { pos: 'FW', x: 50, y: 47 },
      { pos: 'FW', x: 80, y: 45 }
    ];

    const coordsB = [
      { pos: 'GK', x: 50, y: 92 },
      { pos: 'DF', x: 20, y: 78 },
      { pos: 'DF', x: 40, y: 80 },
      { pos: 'DF', x: 60, y: 80 },
      { pos: 'DF', x: 80, y: 78 },
      { pos: 'MF', x: 30, y: 65 },
      { pos: 'MF', x: 50, y: 67 },
      { pos: 'MF', x: 70, y: 65 },
      { pos: 'FW', x: 20, y: 55 },
      { pos: 'FW', x: 50, y: 53 },
      { pos: 'FW', x: 80, y: 55 }
    ];

    return {
      teamA: squadA.map((name, i) => ({ name, ...coordsA[i] })),
      teamB: squadB.map((name, i) => ({ name, ...coordsB[i] }))
    };
  };

  const renderMatchCard = (m) => {
    const isSelected = selectedMatchCenterId === m.id;
    return (
      <div
        key={m.id}
        onClick={() => setSelectedMatchCenterId(m.id)}
        style={{
          background: isSelected ? 'rgba(157, 255, 0, 0.04)' : 'var(--color-surface)',
          border: isSelected ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer',
          transition: 'var(--transition-smooth)',
          position: 'relative'
        }}
      >
        {isSelected && <div style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: '3px', background: 'var(--color-primary)', borderRadius: '0 4px 4px 0' }}></div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={getFlagUrl(m.flagA)} alt={m.teamA} style={{ width: '18px', height: '12px', objectFit: 'cover', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? 'var(--color-primary)' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.teamA}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary)', width: '24px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.scoreA}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={getFlagUrl(m.flagB)} alt={m.teamB} style={{ width: '18px', height: '12px', objectFit: 'cover', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? 'var(--color-primary)' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.teamB}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary)', width: '24px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.scoreB}</span>
            </div>
          </div>

          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', height: '36px', margin: '0 16px', flexShrink: 0 }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '80px', minWidth: '80px', flexShrink: 0, textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: (m.isLive && m.minute !== 'FT') ? 'var(--color-primary)' : 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
              {m.minute}
            </span>
            {m.isLive && m.minute !== 'FT' ? (
              <span style={{ fontSize: '0.6rem', color: '#ff3344', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="live-pulse-dot" style={{ width: '4px', height: '4px', background: '#ff3344', borderRadius: '50%', display: 'inline-block' }}></span>
                LIVE
              </span>
            ) : m.minute === 'FT' ? (
              <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {m.scoreA > m.scoreB
                  ? `${getCleanAbbreviation(m.teamA, m.flagA)} Won`
                  : m.scoreB > m.scoreA
                    ? `${getCleanAbbreviation(m.teamB, m.flagB)} Won`
                    : 'Draw'}
              </span>
            ) : (
              <span style={{ fontSize: '0.6rem', color: 'var(--color-secondary)', marginTop: '2px', fontWeight: 600 }}>Upcoming</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMatchHubDetails = (m) => {
    const isMainActive = activeMatch.id === m.id;
    const isActiveOnChain = getNumericMatchId(m.id) === onChainActiveId && onChainActiveId > 0n;
    const stats = getMatchStats(m);
    const lineups = getLineups(m.teamA, m.teamB);

    const displayJackpot = isSelectedMatchOnChain ? jackpot : 0;
    const displayVotesA = isSelectedMatchOnChain ? teamAVotes : 0;
    const displayVotesB = isSelectedMatchOnChain ? teamBVotes : 0;
    const displayVotesDraw = isSelectedMatchOnChain ? teamDrawVotes : 0;
    const totalVotes = displayVotesA + displayVotesB + displayVotesDraw;
    const percentA = totalVotes > 0 ? ((displayVotesA / totalVotes) * 100).toFixed(0) : '33';
    const percentDraw = totalVotes > 0 ? ((displayVotesDraw / totalVotes) * 100).toFixed(0) : '33';
    const percentB = totalVotes > 0 ? ((displayVotesB / totalVotes) * 100).toFixed(0) : '34';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="match-hub-header">
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
            {m.date} • {m.stadium.split(',')[0]}
          </div>

          <div className="match-hub-teams">
            <div className="match-hub-team-col">
              <img src={getFlagUrl(m.flagA)} alt={m.teamA} className="match-hub-team-flag" />
              <span className="match-hub-team-name">{m.teamA}</span>
            </div>

            <div className="match-hub-score-wrap">
              <span className="match-hub-score">{m.scoreA} - {m.scoreB}</span>
              <span className={`match-hub-minute ${(m.isLive && m.minute !== 'FT') ? 'live' : ''}`}>
                {m.minute === 'FT'
                  ? `FULL TIME (FT) • ${m.scoreA > m.scoreB ? `${m.teamA} Won` : m.scoreB > m.scoreA ? `${m.teamB} Won` : 'Draw'}`
                  : (m.isLive && m.minute !== 'FT')
                    ? `LIVE ${m.minute}`
                    : 'UPCOMING'}
              </span>
            </div>

            <div className="match-hub-team-col">
              <img src={getFlagUrl(m.flagB)} alt={m.teamB} className="match-hub-team-flag" />
              <span className="match-hub-team-name">{m.teamB}</span>
            </div>
          </div>

          {((m.scorersA && m.scorersA.length > 0) || (m.scorersB && m.scorersB.length > 0)) && (
            <div className="match-hub-scorers">
              <div className="scorer-list">
                {m.scorersA?.map((sc, i) => (
                  <div key={i} className="scorer-item">⚽ {sc}</div>
                ))}
              </div>
              <div className="scorer-list right">
                {m.scorersB?.map((sc, i) => (
                  <div key={i} className="scorer-item">{sc} ⚽</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card-bezel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎯 Prediction Jackpot Pool
            </h4>
            {isActiveOnChain ? (
              <span style={{ fontSize: '0.65rem', background: 'rgba(157, 255, 0, 0.15)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                Active On-Chain
              </span>
            ) : (
              <button
                onClick={() => handleActivateMatchOnChain(m)}
                style={{
                  fontSize: '0.65rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.target.style.background = 'var(--color-primary)'; e.target.style.color = '#000'; }}
                onMouseLeave={(e) => { e.target.style.background = 'rgba(255, 255, 255, 0.05)'; e.target.style.color = '#fff'; }}
              >
                Set Active On-Chain
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>Jackpot Size</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-secondary)' }}>{displayJackpot.toFixed(4)} OKB</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>≈ ${(displayJackpot * 60).toFixed(2)} USD</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>Prediction Volume</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>{totalVotes.toFixed(4)} OKB</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>Total user tickets</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{m.teamA} ({percentA}%)</span>
              <span style={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)' }}>Draw ({percentDraw}%)</span>
              <span style={{ fontWeight: 600, color: '#ff007a' }}>{m.teamB} ({percentB}%)</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${percentA}%`, background: 'var(--color-primary)', height: '100%' }}></div>
              <div style={{ width: `${percentDraw}%`, background: 'rgba(255, 255, 255, 0.35)', height: '100%' }}></div>
              <div style={{ width: `${percentB}%`, background: '#ff007a', height: '100%' }}></div>
            </div>
          </div>

          {m.minute === 'FT' ? (() => {
            if (!walletConnected) {
              return (
                <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600 }}>
                  Match Ended ⚽
                </div>
              );
            }
            
            if (!centerMatchPredictions) {
              return (
                <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                  Checking claim eligibility on-chain...
                </div>
              );
            }

            const winnerIndex = centerMatchPredictions.winner;
            const predOnWinner = centerMatchPredictions[winnerIndex];
            const okbAmt = parseFloat(predOnWinner?.okbAmount || '0');
            const grushAmt = parseFloat(predOnWinner?.grushAmount || '0');
            const hasPredictionOnWinner = okbAmt > 0 || grushAmt > 0;

            if (!hasPredictionOnWinner) {
              return (
                <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600 }}>
                  Match Ended ⚽
                </div>
              );
            }

            const okbClaimed = predOnWinner?.okbClaimed;
            const grushClaimed = predOnWinner?.grushClaimed;
            const okbNeedClaim = okbAmt > 0 && !okbClaimed;
            const grushNeedClaim = grushAmt > 0 && !grushClaimed;
            const hasUnclaimed = okbNeedClaim || grushNeedClaim;

            if (hasUnclaimed) {
              return (
                <>
                  <button
                    onClick={() => {
                      handleSelectMatchUI(m);
                      setCurrentView('dashboard');
                      setTimeout(() => {
                        document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="swap-btn"
                    style={{
                      marginTop: '20px',
                      background: 'linear-gradient(135deg, #00e5ff 0%, #9dff00 100%)',
                      color: '#000',
                      fontWeight: 'bold',
                      boxShadow: '0 0 15px rgba(157, 255, 0, 0.4)'
                    }}
                  >
                    View Match & Claim Winnings on Dashboard 🏆
                  </button>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '8px', textAlign: 'center', lineHeight: '1.4', fontWeight: 600 }}>
                    🎉 You won! Click above to claim your OKB/GRUSH rewards on the dashboard.
                  </div>
                </>
              );
            } else {
              return (
                <div style={{
                  marginTop: '20px',
                  padding: '12px',
                  background: 'rgba(157, 255, 0, 0.05)',
                  border: '1px solid rgba(157, 255, 0, 0.25)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: 'var(--color-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}>
                  All Winnings Claimed ✅
                </div>
              );
            }
          })() : (
            <button
              onClick={() => {
                handleSelectMatchUI(m);
                setCurrentView('dashboard');
                setTimeout(() => {
                  document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="swap-btn"
              style={{ marginTop: '20px', background: 'var(--color-primary)', color: '#000', fontWeight: 'bold' }}
            >
              Predict Match Winner & Play Shootout! ⚽
            </button>
          )}
        </div>

        <div className="card-bezel">
          <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px', paddingBottom: '4px' }}>
            <button
              onClick={() => setMatchCenterSubTab('lineup')}
              style={{
                background: 'transparent',
                border: 'none',
                color: matchCenterSubTab === 'lineup' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.5)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '8px 4px',
                cursor: 'pointer',
                borderBottom: matchCenterSubTab === 'lineup' ? '2px solid var(--color-primary)' : '2px solid transparent',
                transition: 'var(--transition-smooth)'
              }}
            >
              Lineups
            </button>
            <button
              onClick={() => setMatchCenterSubTab('stats')}
              style={{
                background: 'transparent',
                border: 'none',
                color: matchCenterSubTab === 'stats' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.5)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '8px 4px',
                cursor: 'pointer',
                borderBottom: matchCenterSubTab === 'stats' ? '2px solid var(--color-primary)' : '2px solid transparent',
                transition: 'var(--transition-smooth)'
              }}
            >
              Match Stats
            </button>
          </div>

          {matchCenterSubTab === 'lineup' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>Formation: <strong>4-3-3 (Classic)</strong></span>
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }}></span> {m.teamA}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-secondary)', display: 'inline-block' }}></span> {m.teamB}</span>
                </div>
              </div>

              <div className="tactical-pitch">
                <div className="tactical-lines"></div>
                <div className="tactical-midline"></div>
                <div className="tactical-center-circle"></div>
                <div className="tactical-box-top"></div>
                <div className="tactical-box-bottom"></div>

                {lineups.teamA.map((p, idx) => (
                  <div key={`ta-${idx}`} className="tactical-player" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                    <div className="tactical-player-circle">{idx + 1}</div>
                    <span className="tactical-player-name">{p.name}</span>
                  </div>
                ))}

                {lineups.teamB.map((p, idx) => (
                  <div key={`tb-${idx}`} className="tactical-player team-b" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                    <div className="tactical-player-circle">{idx + 1}</div>
                    <span className="tactical-player-name">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchCenterSubTab === 'stats' && (
            <div className="match-stats-grid">
              <div className="stat-row-wrap">
                <div className="stat-label-row">
                  <span>{stats.possession[0]}%</span>
                  <span className="stat-label-title">Possession</span>
                  <span>{stats.possession[1]}%</span>
                </div>
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill-a" style={{ width: `${stats.possession[0]}%` }}></div>
                  <div className="stat-bar-fill-b" style={{ width: `${stats.possession[1]}%` }}></div>
                </div>
              </div>

              <div className="stat-row-wrap">
                <div className="stat-label-row">
                  <span>{stats.shots[0]}</span>
                  <span className="stat-label-title">Total Shots</span>
                  <span>{stats.shots[1]}</span>
                </div>
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill-a" style={{ width: `${(stats.shots[0] / (stats.shots[0] + stats.shots[1] || 1)) * 100}%` }}></div>
                  <div className="stat-bar-fill-b" style={{ width: `${(stats.shots[1] / (stats.shots[0] + stats.shots[1] || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div className="stat-row-wrap">
                <div className="stat-label-row">
                  <span>{stats.shotsOnTarget[0]}</span>
                  <span className="stat-label-title">Shots on Target</span>
                  <span>{stats.shotsOnTarget[1]}</span>
                </div>
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill-a" style={{ width: `${(stats.shotsOnTarget[0] / (stats.shotsOnTarget[0] + stats.shotsOnTarget[1] || 1)) * 100}%` }}></div>
                  <div className="stat-bar-fill-b" style={{ width: `${(stats.shotsOnTarget[1] / (stats.shotsOnTarget[0] + stats.shotsOnTarget[1] || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div className="stat-row-wrap">
                <div className="stat-label-row">
                  <span>{stats.corners[0]}</span>
                  <span className="stat-label-title">Corners</span>
                  <span>{stats.corners[1]}</span>
                </div>
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill-a" style={{ width: `${(stats.corners[0] / (stats.corners[0] + stats.corners[1] || 1)) * 100}%` }}></div>
                  <div className="stat-bar-fill-b" style={{ width: `${(stats.corners[1] / (stats.corners[0] + stats.corners[1] || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div className="stat-row-wrap">
                <div className="stat-label-row">
                  <span>{stats.fouls[0]}</span>
                  <span className="stat-label-title">Fouls</span>
                  <span>{stats.fouls[1]}</span>
                </div>
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill-a" style={{ width: `${(stats.fouls[0] / (stats.fouls[0] + stats.fouls[1] || 1)) * 100}%` }}></div>
                  <div className="stat-bar-fill-b" style={{ width: `${(stats.fouls[1] / (stats.fouls[0] + stats.fouls[1] || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div className="stat-row-wrap">
                <div className="stat-label-row">
                  <span>{stats.yellowCards[0]}</span>
                  <span className="stat-label-title">Yellow Cards</span>
                  <span>{stats.yellowCards[1]}</span>
                </div>
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill-a" style={{ width: `${(stats.yellowCards[0] / (stats.yellowCards[0] + stats.yellowCards[1] || 1)) * 100}%` }}></div>
                  <div className="stat-bar-fill-b" style={{ width: `${(stats.yellowCards[1] / (stats.yellowCards[0] + stats.yellowCards[1] || 1)) * 100}%` }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="match-venue-card">
          <div className="venue-icon-wrap">
            🏟️
          </div>
          <div className="venue-details">
            <div className="venue-name">{m.stadium}</div>
            <div className="venue-meta">Capacity: {m.capacity} • City: {m.city}</div>
            <div className="venue-meta" style={{ marginTop: '2px' }}>Referee: <strong>{m.referee}</strong></div>
          </div>
        </div>
      </div>
    );
  };

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('goalrush_history')
    return saved ? JSON.parse(saved) : []
  })
    const [liveMatches, setLiveMatches] = useState([]);
  useEffect(() => {
    liveMatchesRef.current = liveMatches;
  }, [liveMatches]);

  useEffect(() => {
    const loadRealMatches = async () => {
      try {
        let data = [];
        // 1. Try local dev proxy endpoint first
        try {
          const response = await fetch('/api/live');
          if (response.ok) {
            const parsed = await response.json();
            if (Array.isArray(parsed) && parsed.length > 0) {
              data = parsed;
            }
          }
        } catch (e) {
          console.warn('Local dev API fetch failed, trying direct backend fetch...', e);
        }

        // 2. Fall back to fetching and mapping directly from the Railway backend
        if (data.length === 0) {
          const backendUrl = 'https://goal-rush-backend-production.up.railway.app/api/matches/all';
          const response = await fetch(backendUrl);
          if (response.ok) {
            const resBody = await response.json();
            const rawMatches = resBody.data ? resBody.data : resBody;
            if (Array.isArray(rawMatches)) {
              // Map to the frontend format client-side
              const mapped = rawMatches.map(match => {
                const isLive = match.status === 'LIVE';
                const isCompleted = match.status === 'FINISHED';
                
                let minuteDisplay = 'Upcoming';
                if (isLive) {
                  minuteDisplay = `${match.minute || 1}'`;
                } else if (isCompleted) {
                  minuteDisplay = 'FT';
                } else {
                  try {
                    const matchDate = new Date(match.kickoff_utc || match.start_time || match.startTime);
                    if (!isNaN(matchDate.getTime())) {
                      minuteDisplay = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    }
                  } catch (e) {}
                }

                let dateDisplay = 'TBD';
                try {
                  const matchDate = new Date(match.kickoff_utc || match.start_time || match.startTime);
                  if (!isNaN(matchDate.getTime())) {
                    dateDisplay = `${matchDate.toLocaleString('en-US', { month: 'long' })} ${matchDate.getDate()}`;
                  }
                } catch (e) {}

                const homeName = match.home_team || (match.homeTeam && match.homeTeam.name) || 'Unknown';
                const awayName = match.away_team || (match.awayTeam && match.awayTeam.name) || 'Unknown';

                return {
                  id: match.sofaId || match.id,
                  dbId: match.id,
                  teamA: homeName,
                  flagA: getTeamFifaCode(homeName),
                  teamB: awayName,
                  flagB: getTeamFifaCode(awayName),
                  scoreA: match.home_score !== undefined ? match.home_score : match.scoreHome || 0,
                  scoreB: match.away_score !== undefined ? match.away_score : match.scoreAway || 0,
                  minute: minuteDisplay,
                  isLive: isLive,
                  date: dateDisplay,
                  startTime: new Date(match.kickoff_utc || match.start_time || match.startTime || Date.now()).getTime(),
                  stadium: match.stadium || 'Stadium',
                  capacity: 'N/A',
                  city: match.city || 'City',
                  referee: match.referee || 'Referee',
                  scorersA: [],
                  scorersB: []
                };
              });

              data = mapped;
            }
          }
        }

        // 3. Clean and inject the live/scheduled FIFA World Cup 2026 matches
        // Filter out duplicates in case backend has them under different statuses
        const teamPairsToMock = [];
        
        data = data.filter(m => {
          const isMocked = teamPairsToMock.some(pair => 
            (m.teamA === pair[0] && m.teamB === pair[1]) ||
            (m.teamA === pair[1] && m.teamB === pair[0])
          );
          return !isMocked;
        });

        const nowMs = Date.now();
        const getFutureTime = (hours) => nowMs + (hours * 60 * 60 * 1000);

        const getOffsetDateLabel = (daysOffset) => {
          const d = new Date();
          d.setDate(d.getDate() + daysOffset);
          return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getDate()}`;
        };

        const mocks = [
          {
            id: 'mock_por_cod',
            dbId: 'mock_por_cod',
            teamA: 'Portugal',
            flagA: 'POR',
            teamB: 'DR Congo',
            flagB: 'COD',
            scoreA: 0,
            scoreB: 0,
            minute: '14:00',
            isLive: false,
            date: getOffsetDateLabel(0),
            startTime: getFutureTime(3),
            stadium: 'Houston Stadium',
            capacity: '72,000',
            city: 'Houston',
            referee: 'Mustapha Ghorbal',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_eng_cro',
            dbId: 'mock_eng_cro',
            teamA: 'England',
            flagA: 'ENG',
            teamB: 'Croatia',
            flagB: 'CRO',
            scoreA: 0,
            scoreB: 0,
            minute: '1:00 am',
            isLive: false,
            date: getOffsetDateLabel(1),
            startTime: getFutureTime(14),
            stadium: 'Dallas Stadium',
            capacity: '80,000',
            city: 'Dallas',
            referee: 'Szymon Marciniak',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_gha_pan',
            dbId: 'mock_gha_pan',
            teamA: 'Ghana',
            flagA: 'GHA',
            teamB: 'Panama',
            flagB: 'PAN',
            scoreA: 0,
            scoreB: 0,
            minute: '4:30 am',
            isLive: false,
            date: getOffsetDateLabel(1),
            startTime: getFutureTime(17.5),
            stadium: 'Toronto Stadium',
            capacity: '45,000',
            city: 'Toronto',
            referee: 'Victor Gomes',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_uzb_col',
            dbId: 'mock_uzb_col',
            teamA: 'Uzbekistan',
            flagA: 'UZB',
            teamB: 'Colombia',
            flagB: 'COL',
            scoreA: 0,
            scoreB: 0,
            minute: '7:00 am',
            isLive: false,
            date: getOffsetDateLabel(1),
            startTime: getFutureTime(20),
            stadium: 'Mexico City Stadium',
            capacity: '87,000',
            city: 'Mexico City',
            referee: 'Cesar Ramos',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_cze_rsa',
            dbId: 'mock_cze_rsa',
            teamA: 'Czechia',
            flagA: 'CZE',
            teamB: 'South Africa',
            flagB: 'RSA',
            scoreA: 0,
            scoreB: 0,
            minute: '9:30 am',
            isLive: false,
            date: getOffsetDateLabel(1),
            startTime: getFutureTime(22.5),
            stadium: 'Mercedes-Benz Stadium',
            capacity: '71,000',
            city: 'Atlanta',
            referee: 'Michael Oliver',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_sui_bih',
            dbId: 'mock_sui_bih',
            teamA: 'Switzerland',
            flagA: 'SUI',
            teamB: 'Bosnia and Herzegovina',
            flagB: 'BIH',
            scoreA: 0,
            scoreB: 0,
            minute: '12:00 pm',
            isLive: false,
            date: getOffsetDateLabel(2),
            startTime: getFutureTime(48),
            stadium: 'SoFi Stadium',
            capacity: '70,000',
            city: 'Los Angeles',
            referee: 'Felix Zwayer',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_can_qat',
            dbId: 'mock_can_qat',
            teamA: 'Canada',
            flagA: 'CAN',
            teamB: 'Qatar',
            flagB: 'QAT',
            scoreA: 0,
            scoreB: 0,
            minute: '2:30 pm',
            isLive: false,
            date: getOffsetDateLabel(2),
            startTime: getFutureTime(50.5),
            stadium: 'BC Place',
            capacity: '54,000',
            city: 'Vancouver',
            referee: 'Abdulrahman Al-Jassim',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_mex_kor',
            dbId: 'mock_mex_kor',
            teamA: 'Mexico',
            flagA: 'MEX',
            teamB: 'South Korea',
            flagB: 'KOR',
            scoreA: 0,
            scoreB: 0,
            minute: '5:00 pm',
            isLive: false,
            date: getOffsetDateLabel(2),
            startTime: getFutureTime(53),
            stadium: 'Estadio Guadalajara',
            capacity: '48,000',
            city: 'Zapopan',
            referee: 'Danny Makkelie',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_usa_aus',
            dbId: 'mock_usa_aus',
            teamA: 'USA',
            flagA: 'USA',
            teamB: 'Australia',
            flagB: 'AUS',
            scoreA: 0,
            scoreB: 0,
            minute: '12:00 pm',
            isLive: false,
            date: getOffsetDateLabel(3),
            startTime: getFutureTime(72),
            stadium: 'MetLife Stadium',
            capacity: '82,500',
            city: 'East Rutherford',
            referee: 'Michael Oliver',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_sco_mar',
            dbId: 'mock_sco_mar',
            teamA: 'Scotland',
            flagA: 'SCO',
            teamB: 'Morocco',
            flagB: 'MAR',
            scoreA: 0,
            scoreB: 0,
            minute: '4:30 pm',
            isLive: false,
            date: getOffsetDateLabel(3),
            startTime: getFutureTime(76.5),
            stadium: 'Lumen Field',
            capacity: '68,000',
            city: 'Seattle',
            referee: 'Wilmar Roldan',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_svk_hai',
            dbId: 'mock_svk_hai',
            teamA: 'Slovakia',
            flagA: 'SVK',
            teamB: 'Haiti',
            flagB: 'HAI',
            scoreA: 0,
            scoreB: 0,
            minute: '9:30 pm',
            isLive: false,
            date: getOffsetDateLabel(3),
            startTime: getFutureTime(81.5),
            stadium: 'Gillette Stadium',
            capacity: '65,800',
            city: 'Foxborough',
            referee: 'Cesar Ramos',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_tur_par',
            dbId: 'mock_tur_par',
            teamA: 'Turkey',
            flagA: 'TUR',
            teamB: 'Paraguay',
            flagB: 'PAR',
            scoreA: 0,
            scoreB: 0,
            minute: '1:00 am',
            isLive: false,
            date: getOffsetDateLabel(4),
            startTime: getFutureTime(96),
            stadium: 'Arrowhead Stadium',
            capacity: '76,000',
            city: 'Kansas City',
            referee: 'Mustapha Ghorbal',
            scorersA: [],
            scorersB: []
          },
          {
            id: 'mock_ned_srb',
            dbId: 'mock_ned_srb',
            teamA: 'Netherlands',
            flagA: 'NED',
            teamB: 'Serbia',
            flagB: 'SRB',
            scoreA: 0,
            scoreB: 0,
            minute: '6:30 am',
            isLive: false,
            date: getOffsetDateLabel(4),
            startTime: getFutureTime(101.5),
            stadium: 'Lincoln Financial Field',
            capacity: '67,500',
            city: 'Philadelphia',
            referee: 'Szymon Marciniak',
            scorersA: [],
            scorersB: []
          }
        ];
        // data.push(...mocks);
        data.sort((a, b) => a.startTime - b.startTime);
        setLiveMatches(data);

        let defaultMatch = data.find(m => m.isLive);
        if (!defaultMatch) {
          defaultMatch = data.find(m => !m.isLive && m.minute !== 'FT');
        }
        if (!defaultMatch && data.length > 0) {
          defaultMatch = data[0];
        }

        if (defaultMatch) {
          setSelectedMatchCenterId(prev => prev === 10 ? defaultMatch.id : prev);
          setActiveMatch(prev => {
            if (prev.id === 10) {
              return {
                ...prev,
                id: defaultMatch.id,
                dbId: defaultMatch.dbId,
                startTime: defaultMatch.startTime,
                teamA: defaultMatch.teamA,
                teamB: defaultMatch.teamB,
                flagA: defaultMatch.flagA || getTeamFifaCode(defaultMatch.teamA),
                flagB: defaultMatch.flagB || getTeamFifaCode(defaultMatch.teamB),
                resolved: false,
                isLive: defaultMatch.isLive !== undefined ? defaultMatch.isLive : true,
                minute: defaultMatch.minute || "1'"
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Failed to load real-world matches:', err);
      }
    };

    loadRealMatches();
    const interval = setInterval(loadRealMatches, 60000); // refresh every minute to catch anything socket missed
    return () => clearInterval(interval);
  }, []);

  const [logs, setLogs] = useState([
    'System: GoalRush Hook verified on X Layer. Ready for mainnet deployment.',
    'System: Active Match is accepting predictions.',
    'System: Current jackpot pool backed by native OKB.'
  ])

  const handleNavClick = (sectionId) => {
    setShowDevPortal(true);
  }

  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false)
  const [userAddress, setUserAddress] = useState('')
  const [userBalance, setUserBalance] = useState('0.00')
  const [grushBalance, setGrushBalance] = useState('0.00')
  const [chainId, setChainId] = useState(null)
  const [userPredictions, setUserPredictions] = useState(null)

  const [isStriking, setIsStriking] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState({
    tone: 'idle',
    message: 'No transaction is pending. Review the match, pick, token, and amount before signing.'
  })
  const [showGoalFlash, setShowGoalFlash] = useState(false)
  const [userScore, setUserScore] = useState(() => {
    return Number(localStorage.getItem('goalrush_userScore') || '0');
  })
  const [totalUserVolume, setTotalUserVolume] = useState(() => {
    return parseFloat(localStorage.getItem('goalrush_userVolume') || '0');
  })
  const [onChainStats, setOnChainStats] = useState({});
  const [scanState, setScanState] = useState({ current: 62494373, total: 62494373, done: false });

  // Past-match claim checker state
  const [showPastClaimChecker, setShowPastClaimChecker] = useState(false);
  const [caCopied, setCaCopied] = useState(false);
  const [pastMatchInput, setPastMatchInput] = useState('');
  const [pastClaimResult, setPastClaimResult] = useState(null);
  const [pastClaimLoading, setPastClaimLoading] = useState(false);

  const [centerMatchPredictions, setCenterMatchPredictions] = useState(null);

  useEffect(() => {
    const fetchCenterPrediction = async () => {
      if (!walletConnected || !userAddress || !selectedMatchCenterId) {
        setCenterMatchPredictions(null);
        return;
      }
      try {
        const rpcProvider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
        const queryAbi = [
          "function getUserPredictions(uint256 _matchId, address _user) external view returns (uint256[4] okbAmounts, uint256[4] grushAmounts, bool[4] okbClaimeds, bool[4] grushClaimeds)",
          "function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
        ];
        const queryContract = new ethers.Contract(HOOK_ADDRESS, queryAbi, rpcProvider);
        const numericId = getNumericMatchId(selectedMatchCenterId);
        
        const onChainMatch = await queryContract.matches(numericId);
        if (onChainMatch[0] === 0n) {
          setCenterMatchPredictions(null);
          return;
        }

        const [okbAmounts, grushAmounts, okbClaimeds, grushClaimeds] = await queryContract.getUserPredictions(numericId, userAddress);
        
        const predsObj = {
          resolved: onChainMatch[5],
          winner: Number(onChainMatch[6])
        };
        for (let i = 1; i <= 3; i++) {
          predsObj[i] = {
            okbAmount: ethers.formatEther(okbAmounts[i] || 0n),
            grushAmount: ethers.formatEther(grushAmounts[i] || 0n),
            okbClaimed: okbClaimeds[i],
            grushClaimed: grushClaimeds[i]
          };
        }
        setCenterMatchPredictions(predsObj);
      } catch (e) {
        setCenterMatchPredictions(null);
      }
    };
    fetchCenterPrediction();
    const interval = setInterval(fetchCenterPrediction, 8000);
    return () => clearInterval(interval);
  }, [walletConnected, userAddress, selectedMatchCenterId]);

  // Known past matches for quick selection
  const knownPastMatches = useMemo(() => {
    const list = [];
    if (Array.isArray(liveMatches)) {
      liveMatches.forEach(m => {
        if (m && (m.minute === 'FT' || m.status === 'FINISHED')) {
          if (!list.some(item => item.matchId === m.id)) {
            list.push({ label: `${m.teamA} vs ${m.teamB}`, matchId: m.id });
          }
        }
      });
    }
    const historical = [
      { label: 'United States vs Australia', matchId: 'espn_760442' },
      { label: 'France vs Senegal', matchId: 'espn_760432' },
      { label: 'Canada vs Bosnia & Herzegovina', matchId: '1' },
    ];
    historical.forEach(h => {
      if (!list.some(item => item.matchId === h.matchId)) {
        list.push(h);
      }
    });
    return list;
  }, [liveMatches]);

  const handleCheckPastClaim = async (matchIdInput) => {
    if (!walletConnected || !userAddress) {
      alert('Connect your wallet first to check claims.');
      return;
    }
    if (!matchIdInput) return;

    setPastClaimLoading(true);
    setPastClaimResult(null);
    try {
      const rpcProvider = new ethers.JsonRpcProvider('https://rpc.xlayer.tech');
      const abi = [
        'function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)',
        'function getUserPredictions(uint256 _matchId, address _user) external view returns (uint256[4] okbAmounts, uint256[4] grushAmounts, bool[4] okbClaimeds, bool[4] grushClaimeds)'
      ];
      const hook = new ethers.Contract(HOOK_ADDRESS, abi, rpcProvider);
      const numericId = getNumericMatchId(matchIdInput);
      const matchData = await hook.matches(numericId);
      const exists = matchData[0] !== 0n;

      if (!exists) {
        setPastClaimResult({ error: `No match found on-chain for ID "${matchIdInput}".` });
        return;
      }

      const [okbAmounts, grushAmounts, okbClaimeds, grushClaimeds] = await hook.getUserPredictions(numericId, userAddress);
      const teamA = matchData[1];
      const teamB = matchData[2];
      const resolved = matchData[5];
      const winner = Number(matchData[6]);
      const jackpot = ethers.formatEther(matchData[7]);

      let predictedTeam = 0;
      let okbAmt = '0.0';
      let grushAmt = '0.0';
      let okbClaimed = false;
      let grushClaimed = false;

      for (let i = 1; i <= 3; i++) {
        const oAmt = ethers.formatEther(okbAmounts[i] || 0n);
        const gAmt = ethers.formatEther(grushAmounts[i] || 0n);
        if (parseFloat(oAmt) > 0 || parseFloat(gAmt) > 0) {
          if (resolved && i === winner) {
            predictedTeam = i;
            okbAmt = oAmt;
            grushAmt = gAmt;
            okbClaimed = okbClaimeds[i];
            grushClaimed = grushClaimeds[i];
            break;
          } else if (predictedTeam === 0) {
            predictedTeam = i;
            okbAmt = oAmt;
            grushAmt = gAmt;
            okbClaimed = okbClaimeds[i];
            grushClaimed = grushClaimeds[i];
          }
        }
      }

      setPastClaimResult({
        matchIdInput,
        numericId,
        teamA, teamB, resolved, winner, jackpot,
        predictedTeam, okbAmount: okbAmt, grushAmount: grushAmt, okbClaimed, grushClaimed,
        isWinner: resolved && predictedTeam > 0 && predictedTeam === winner,
        hasPrediction: parseFloat(okbAmt) > 0 || parseFloat(grushAmt) > 0,
      });
    } catch (e) {
      console.error('Past claim check error:', e);
      setPastClaimResult({ error: `Failed to query contract: ${e.message}` });
    } finally {
      setPastClaimLoading(false);
    }
  };

  const handleClaimPastOkb = async (numericId) => {
    try {
      const rawProvider = getProvider();
      if (!rawProvider) throw new Error('No wallet provider');
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const hook = new ethers.Contract(HOOK_ADDRESS, ['function claimJackpot(uint256) external'], signer);
      addLog(`[claimJackpot] Claiming past match OKB jackpot...`);
      const tx = await hook.claimJackpot(numericId);
      await tx.wait();
      addLog('🎉 OKB Jackpot claimed successfully!');
      alert('OKB Jackpot claimed!');
      handleCheckPastClaim(pastClaimResult?.matchIdInput || '');
    } catch (err) {
      addLog(`❌ Claim failed: ${err.reason || err.message}`);
      alert(`Claim failed: ${err.reason || err.message}`);
    }
  };

  const handleClaimPastGrush = async (numericId) => {
    try {
      const rawProvider = getProvider();
      if (!rawProvider) throw new Error('No wallet provider');
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const hook = new ethers.Contract(HOOK_ADDRESS, ['function claimGrushJackpot(uint256) external'], signer);
      addLog(`[claimGrushJackpot] Claiming past match GRUSH jackpot...`);
      const tx = await hook.claimGrushJackpot(numericId);
      await tx.wait();
      addLog('🎉 GRUSH Jackpot claimed successfully!');
      alert('GRUSH Jackpot claimed!');
      handleCheckPastClaim(pastClaimResult?.matchIdInput || '');
    } catch (err) {
      addLog(`❌ GRUSH claim failed: ${err.reason || err.message}`);
      alert(`GRUSH claim failed: ${err.reason || err.message}`);
    }
  };



  const leaderboardData = useMemo(() => {
    const merged = { ...onChainStats };

    // Layer local storage for the connected user so UI is updated instantly
    if (userAddress) {
      const lower = userAddress.toLowerCase();
      const localG = Number(localStorage.getItem('goalrush_userScore') || '0');
      const localV = parseFloat(localStorage.getItem('goalrush_userVolume') || '0');
      const localVWei = ethers.parseEther(localV.toFixed(18));

      if (!merged[lower]) {
        merged[lower] = {
          address: userAddress,
          goals: localG,
          volume: localVWei,
          grushVolume: 0n,
          claimed: 0n,
          grushClaimed: 0n
        };
      } else {
        const currentVolBig = typeof merged[lower].volume === 'bigint'
          ? merged[lower].volume
          : ethers.parseEther((merged[lower].volume || 0).toString());

        merged[lower] = {
          ...merged[lower],
          goals: Math.max(merged[lower].goals, localG),
          volume: currentVolBig > localVWei ? currentVolBig : localVWei
        };
      }
    }

    // Convert to list
    const statsArray = Object.values(merged).map(item => {
      return {
        address: item.address,
        goals: item.goals,
        volume: typeof item.volume === 'bigint' ? Number(ethers.formatEther(item.volume)) : Number(item.volume),
        grushVolume: typeof item.grushVolume === 'bigint' ? Number(ethers.formatEther(item.grushVolume)) : Number(item.grushVolume || 0),
        claimed: typeof item.claimed === 'bigint' ? Number(ethers.formatEther(item.claimed)) : Number(item.claimed),
        grushClaimed: typeof item.grushClaimed === 'bigint' ? Number(ethers.formatEther(item.grushClaimed)) : Number(item.grushClaimed || 0)
      };
    });

    // Sort leaderboard: goals desc, then OKB volume desc, then GRUSH volume desc
    statsArray.sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.volume !== a.volume) return b.volume - a.volume;
      return b.grushVolume - a.grushVolume;
    });

    return statsArray;
  }, [onChainStats, userAddress, userScore, totalUserVolume]);
  const [opponentScore, setOpponentScore] = useState(0)
  const [goalsScoredCount, setGoalsScoredCount] = useState(14)

  // Soccer field physics & position state
  const [ballPos, setBallPos] = useState({ x: 50, y: 50 })
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 56 })
  const [gkPos, setGkPos] = useState({ x: 2, y: 50 })

  useEffect(() => {
    const provider = getProvider();
    if (provider) {
      // Get current accounts if already connected
      provider.request({ method: 'eth_accounts' })
        .then(handleAccountsChanged)
        .catch(console.error);

      // Listen for account/network changes
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged', handleChainChanged);
    }
    return () => {
      const p = getProvider();
      if (p) {
        p.removeListener('accountsChanged', handleAccountsChanged);
        p.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);



  // Sync activeMatch score/minute whenever liveMatches updates
  useEffect(() => {
    if (!activeMatch?.id) return;
    const updated = liveMatches.find(m => m.id === activeMatch.id);
    if (updated && (
      updated.scoreA !== activeMatch.scoreA ||
      updated.scoreB !== activeMatch.scoreB ||
      updated.minute !== activeMatch.minute ||
      updated.isLive !== activeMatch.isLive
    )) {
      setActiveMatch(prev => ({
        ...prev,
        scoreA: updated.scoreA,
        scoreB: updated.scoreB,
        scorersA: updated.scorersA,
        scorersB: updated.scorersB,
        minute: updated.minute,
        isLive: updated.isLive,
        resolved: updated.minute === 'FT' ? true : prev.resolved
      }));
    }
  }, [liveMatches]);

  const prevLiveMatchesRef = useRef([]);

  useEffect(() => {
    const prevMatches = prevLiveMatchesRef.current;
    if (prevMatches && prevMatches.length > 0 && liveMatches && liveMatches.length > 0) {
      liveMatches.forEach(m => {
        const prev_m = prevMatches.find(pm => pm.id === m.id);
        if (!prev_m) return;
        
        if (m.scoreA > prev_m.scoreA) {
          setLogs(logs => [`⚽ GOAL! ${m.teamA} ${m.scoreA}–${m.scoreB} ${m.teamB} (${m.minute})`, ...logs].slice(0, 50));
        } else if (m.scoreB > prev_m.scoreB) {
          setLogs(logs => [`⚽ GOAL! ${m.teamB} ${m.scoreA}–${m.scoreB} ${m.teamA} (${m.minute})`, ...logs].slice(0, 50));
        }
        if (!prev_m.isLive && m.isLive) {
          setLogs(logs => [`🟢 KICK OFF: ${m.teamA} vs ${m.teamB} has started!`, ...logs].slice(0, 50));
        }
        if (prev_m.isLive && m.minute === 'FT') {
          const winner = m.scoreA > m.scoreB ? m.teamA : m.scoreB > m.scoreA ? m.teamB : 'Draw';
          setLogs(logs => [`🏁 FT: ${m.teamA} ${m.scoreA}–${m.scoreB} ${m.teamB} — ${winner === 'Draw' ? 'Draw!' : winner + ' wins!'}`, ...logs].slice(0, 50));
        }
      });
    }
    prevLiveMatchesRef.current = liveMatches;
  }, [liveMatches]);

  useEffect(() => {
    const socketUrl = 'https://goal-rush-backend-production.up.railway.app';
    const socket = io(socketUrl, { reconnectionDelayMax: 10000 });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to Goal Rush Backend Socket Server');
    });

    // Listen for realtime match events
    socket.on('match_event', (data) => {
      console.log('Received socket event:', data);
      const { type, match, event } = data;

      if (type === 'match_updated' && match) {
        setLiveMatches((prev) =>
          prev.map((m) => {
            if (m.dbId === match.id) {
              const isLive = match.status === 'LIVE';
              const isCompleted = match.status === 'FINISHED';
              
              let minuteDisplay = 'Upcoming';
              if (isLive) {
                minuteDisplay = `${match.minute}'`;
              } else if (isCompleted) {
                minuteDisplay = 'FT';
              }

              return {
                ...m,
                scoreA: match.scoreHome,
                scoreB: match.scoreAway,
                minute: minuteDisplay,
                isLive: isLive
              };
            }
            return m;
          })
        );

        // Also update the selected match in details if the active match updates
        setActiveMatch((prevActive) => {
          if (prevActive && prevActive.dbId === match.id) {
            const isLive = match.status === 'LIVE';
            const isCompleted = match.status === 'FINISHED';
            
            let minuteDisplay = 'Upcoming';
            if (isLive) {
              minuteDisplay = `${match.minute}'`;
            } else if (isCompleted) {
              minuteDisplay = 'FT';
            }

            return {
              ...prevActive,
              scoreA: match.scoreHome,
              scoreB: match.scoreAway,
              minute: minuteDisplay,
              isLive: isLive
            };
          }
          return prevActive;
        });
      }

      if (type === 'new_event' && event) {
        const targetMatch = liveMatchesRef.current.find(m => m.dbId === data.matchId);
        if (targetMatch) {
          const matchName = `${targetMatch.teamA} vs ${targetMatch.teamB}`;
          addLog(`⚽ [Incident] ${event.type} - ${event.player} (${event.minute}') - ${event.detail || ''}`);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Separate hook to subscribe to rooms as matches get loaded
  useEffect(() => {
    if (!socketRef.current) return;
    liveMatches.forEach((m) => {
      if (m.dbId) {
        socketRef.current.emit('join_match', m.dbId);
      }
    });
  }, [liveMatches]);

  useEffect(() => {
    const fetchOnChainData = async () => {
      try {
        const hookAddress = HOOK_ADDRESS;
        const routerAddress = ROUTER_ADDRESS;

        // Use official public RPC for general reads to bypass CORS/adblocker blocks, and Sentio for logs
        const rpcProvider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
        const logProvider = new ethers.JsonRpcProvider("https://xlayer-mainnet.rpc.sentio.xyz");
        const abi = [
          "function activeMatchId() external view returns (uint256)",
          "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
          "function teamPredictionVolume(uint256, uint8) external view returns (uint256)",
          "function teamGrushPredictionVolume(uint256, uint8) external view returns (uint256)",
          "function matchGrushJackpot(uint256) external view returns (uint256)",
          "event GoalScored(address indexed swapper, uint256 bonusAmount)",
          "event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)",
          "event GrushPredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)",
          "event JackpotClaimed(address indexed user, uint256 indexed matchId, uint256 amount)",
          "event GrushJackpotClaimed(address indexed user, uint256 indexed matchId, uint256 amount)"
        ];

        const routerAbi = [
          "event PredictionDeposited(address indexed user, uint8 indexed team, uint256 amount)",
          "event GrushPredictionDeposited(address indexed user, uint8 indexed team, uint256 amount)",
          "event PredictionDeposited(address indexed user, uint256 amount)",
          "event GrushPredictionDeposited(address indexed user, uint256 amount)"
        ];

        const hookContract = new ethers.Contract(hookAddress, abi, rpcProvider);
        const routerContract = new ethers.Contract(routerAddress, routerAbi, rpcProvider);

        let currentId = activeMatchRef.current.id;

        // If not initialized yet from the contract, query the default activeMatchId
        if (!hasInitializedRef.current) {
          try {
            const activeId = await hookContract.activeMatchId();
            if (activeId > 0n) {
              hasInitializedRef.current = true;
              try {
                const actMatchData = await hookContract.matches(activeId);
                const actTeamA = actMatchData[1] || actMatchData.teamA || 'Canada';
                const actTeamB = actMatchData[2] || actMatchData.teamB || 'Bosnia & Herzegovina';
                
                // Find a matching match in liveMatches list (by checking getNumericMatchId)
                const matchedLive = liveMatchesRef.current.find(m => getNumericMatchId(m.id) === activeId);
                
                activeOnChainMatchRef.current = {
                  id: matchedLive ? matchedLive.id : activeId.toString(),
                  teamA: actTeamA,
                  teamB: actTeamB
                };

                // Auto-select active match if user hasn't selected anything else yet
                if (activeMatchRef.current.id === 10) {
                  if (matchedLive) {
                    handleSelectMatchUI(matchedLive);
                    setSelectedMatchCenterId(matchedLive.id);
                  } else {
                    setActiveMatch({
                      id: activeId.toString(),
                      teamA: actTeamA,
                      teamB: actTeamB,
                      flagA: getTeamFifaCode(actTeamA),
                      flagB: getTeamFifaCode(actTeamB),
                      resolved: false,
                      winner: 0
                    });
                    setSelectedMatchCenterId(activeId.toString());
                  }
                }
              } catch (e) {
                console.warn("Failed to fetch details for default active match:", e);
              }
            }
          } catch (activeIdErr) {
            console.warn("Failed to fetch activeMatchId on initialization:", activeIdErr);
          }
        }

        const activeIdFromContract = await hookContract.activeMatchId();
        setOnChainActiveId(activeIdFromContract);

        const numericId = getNumericMatchId(currentId);
        console.log("[fetchOnChainData] currentId:", currentId, "numericId:", numericId.toString(), "activeIdFromContract:", activeIdFromContract.toString());

        // Fetch selected match info safely
        try {
          const matchData = await hookContract.matches(numericId);
          // Consider a match "on-chain" if:
          // 1. matchData[0] != 0 (it was stored under this exact numericId), OR
          // 2. The selected match's numericId equals the contract's activeMatchId
          //    (handles cases where the ID mapping is slightly off but the match IS active)
          const existsByData = matchData[0] !== 0n;
          const isActiveMatchSelected = activeIdFromContract > 0n && numericId === activeIdFromContract;
          const exists = existsByData || isActiveMatchSelected;
          console.log("[fetchOnChainData] matchData.id:", matchData[0].toString(), "existsByData:", existsByData, "isActiveMatchSelected:", isActiveMatchSelected, "exists:", exists);
          setIsSelectedMatchOnChain(exists);

          if (exists) {
            // If we only matched via activeMatchId (not by direct data lookup), re-fetch using activeIdFromContract
            let effectiveMatchData = matchData;
            let effectiveNumericId = numericId;
            if (!existsByData && isActiveMatchSelected) {
              try {
                effectiveMatchData = await hookContract.matches(activeIdFromContract);
                effectiveNumericId = activeIdFromContract;
                console.log("[fetchOnChainData] Fallback: fetched data via activeIdFromContract:", activeIdFromContract.toString());
              } catch (fallbackErr) {
                console.warn("[fetchOnChainData] Fallback fetch by activeIdFromContract failed:", fallbackErr);
              }
            }

            const teamAName = effectiveMatchData[1] || effectiveMatchData.teamA || 'Team A';
            const teamBName = effectiveMatchData[2] || effectiveMatchData.teamB || 'Team B';
            const isResolved = effectiveMatchData[5] !== undefined ? effectiveMatchData[5] : effectiveMatchData.resolved;
            const winnerId = Number(effectiveMatchData[6] !== undefined ? effectiveMatchData[6] : (effectiveMatchData.winner || 0));

            // Keep the active onchain match ref updated
            if (numericId === activeIdFromContract) {
              activeOnChainMatchRef.current = {
                id: currentId,
                teamA: teamAName,
                teamB: teamBName
              };
            }

            const totalJackpotWei = effectiveMatchData[7] || effectiveMatchData.totalJackpot || 0n;
            // OKB predictions are held by the Router contract - check both
            const hookBalance = await rpcProvider.getBalance(hookAddress);
            const routerBalance = await rpcProvider.getBalance(routerAddress);
            const combinedBalance = hookBalance + routerBalance;
            const displayJackpot = combinedBalance > totalJackpotWei ? combinedBalance : totalJackpotWei;
            setJackpot(Number(ethers.formatEther(displayJackpot)));

            const volA = await hookContract.teamPredictionVolume(effectiveNumericId, 1);
            const volB = await hookContract.teamPredictionVolume(effectiveNumericId, 2);
            const volDraw = await hookContract.teamPredictionVolume(effectiveNumericId, 3);
            setTeamAVotes(Number(ethers.formatEther(volA)));
            setTeamBVotes(Number(ethers.formatEther(volB)));
            setTeamDrawVotes(Number(ethers.formatEther(volDraw)));

            // Read GRUSH jackpot - check both new and old Hook contracts
            try {
              const grushAbi = ["function balanceOf(address) view returns (uint256)"];
              const grushContract = new ethers.Contract(GRUSH_TOKEN_ADDRESS, grushAbi, rpcProvider);
              // Check new Hook first, then old Hook as fallback
              const newHookGrush = await grushContract.balanceOf(hookAddress);
              const oldHookGrush = await grushContract.balanceOf('0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0');
              const totalGrush = newHookGrush + oldHookGrush;
              setGrushJackpot(Number(ethers.formatEther(totalGrush)));
              try {
                const grushVolA = await hookContract.teamGrushPredictionVolume(effectiveNumericId, 1);
                const grushVolB = await hookContract.teamGrushPredictionVolume(effectiveNumericId, 2);
                const grushVolDraw = await hookContract.teamGrushPredictionVolume(effectiveNumericId, 3);
                setTeamAGrushVotes(Number(ethers.formatEther(grushVolA)));
                setTeamBGrushVotes(Number(ethers.formatEther(grushVolB)));
                setTeamDrawGrushVotes(Number(ethers.formatEther(grushVolDraw)));
              } catch (_) {
                setTeamAGrushVotes(0);
                setTeamBGrushVotes(0);
                setTeamDrawGrushVotes(0);
              }
            } catch (grushErr) {
              setGrushJackpot(0);
            }

            // Sync resolution state for current match in UI if activeMatch corresponds to this match
            setActiveMatch(prev => {
              if (prev.id !== currentId) return prev;
              if (prev.teamA === teamAName && prev.teamB === teamBName && prev.resolved === isResolved && prev.winner === winnerId) {
                return prev;
              }
              return {
                ...prev,
                resolved: isResolved,
                winner: winnerId
              };
            });
          } else {
            // Match does not exist on contract yet
            setJackpot(0);
            setGrushJackpot(0);
            setTeamAVotes(0);
            setTeamBVotes(0);
            setTeamDrawVotes(0);
            setTeamAGrushVotes(0);
            setTeamBGrushVotes(0);
            setTeamDrawGrushVotes(0);
          }
        } catch (matchErr) {
          console.warn("Failed to fetch match data from hook contract for ID:", currentId, matchErr);
        }

        // Fetch new events starting from last fetched block
        const latestBlock = await rpcProvider.getBlockNumber();
        // Always scan from deployment block so we never miss historical txns
        const DEPLOY_BLOCK = 62494373;
        if (!leaderboardScannedRef.current && !hasInitializedLeaderboardRef.current) {
          // Reset cache for a clean full rescan only once on component mount
          statsCacheRef.current = {};
          lastFetchedBlockRef.current = DEPLOY_BLOCK;
          hasInitializedLeaderboardRef.current = true;
        }
        const startBlock = lastFetchedBlockRef.current || DEPLOY_BLOCK;

        if (!leaderboardScannedRef.current) {
          setScanState(prev => {
            const nextCurrent = Math.max(prev.current, startBlock);
            if (prev.total !== latestBlock || prev.current !== nextCurrent) {
              return { ...prev, current: nextCurrent, total: latestBlock, done: false };
            }
            return prev;
          });
        } else {
          setScanState({ current: latestBlock, total: latestBlock, done: true });
        }


        if (latestBlock >= startBlock) {
          // Fix: Sentio supports up to 100,000 block ranges per query.
          // We use 50,000 to be extremely fast and robust.
          const chunkSize = 50000;
          let allSuccess = true;

          // Process retrieved events and accumulate in statsCache
          const stats = statsCacheRef.current;
           const getOrCreateUser = (addr) => {
             const lower = addr.toLowerCase();
             if (!stats[lower]) {
               stats[lower] = {
                 address: addr,
                 goals: 0,
                 volume: 0n,
                 grushVolume: 0n,
                 claimed: 0n,
                 grushClaimed: 0n
               };
             }
             return stats[lower];
           };

          const tokenAddress = GRUSH_TOKEN_ADDRESS;
          const tokenInterface = new ethers.Interface([
            "event Transfer(address indexed from, address indexed to, uint256 value)"
          ]);

          // Query in chunks of blocks sequentially using getLogs to avoid batch limits on free tier
          let chunksProcessed = 0;
          for (let from = startBlock; from <= latestBlock; from += chunkSize) {
            if (chunksProcessed >= 100) {
              break; // Yield to next run to avoid RPC rate-limits
            }
            const to = Math.min(from + chunkSize - 1, latestBlock);
            try {
              const logs = await logProvider.getLogs({
                address: [
                  hookAddress, 
                  routerAddress, 
                  '0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0',
                  '0xB8332a105f2ea7F53Bd94554F74658Bf767f8D67',
                  '0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0', 
                  '0xe1Ad1C1Ab7600E6c3Fbaf0c80c3b947B7F901B7F'
                ],
                fromBlock: from,
                toBlock: to
              });

              logs.forEach(log => {
                const addrLower = log.address.toLowerCase();
                if (addrLower === hookAddress.toLowerCase() || 
                    addrLower === '0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0'.toLowerCase() ||
                    addrLower === '0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0'.toLowerCase()) {
                  try {
                    const parsed = hookContract.interface.parseLog(log);
                    if (parsed) {
                      if (parsed.name === "GoalScored") {
                        const swapper = parsed.args[0];
                        getOrCreateUser(swapper).goals += 1;
                      } else if (parsed.name === "PredictionPlaced") {
                        const user = parsed.args[0];
                        const volume = parsed.args[3];
                        getOrCreateUser(user).volume += BigInt(volume);
                      } else if (parsed.name === "GrushPredictionPlaced") {
                        const user = parsed.args[0];
                        const volume = parsed.args[3];
                        getOrCreateUser(user).grushVolume += BigInt(volume);
                      } else if (parsed.name === "JackpotClaimed") {
                        const user = parsed.args[0];
                        const amount = parsed.args[2];
                        getOrCreateUser(user).claimed += BigInt(amount);
                      } else if (parsed.name === "GrushJackpotClaimed") {
                        const user = parsed.args[0];
                        const amount = parsed.args[2];
                        getOrCreateUser(user).grushClaimed += BigInt(amount);
                      }
                    }
                  } catch (e) {
                    // Ignore decoding errors
                  }
                } else if (addrLower === routerAddress.toLowerCase() || 
                           addrLower === '0xB8332a105f2ea7F53Bd94554F74658Bf767f8D67'.toLowerCase() ||
                           addrLower === '0xe1Ad1C1Ab7600E6c3Fbaf0c80c3b947B7F901B7F'.toLowerCase()) {
                  try {
                    // Parse raw log directly since deployed contract may differ from source
                    // Topic[0] = event sig, Topic[1] = indexed user address
                    // data = abi-encoded (amount) or (team, amount) depending on version
                    if (log.topics.length >= 2) {
                      const user = ethers.getAddress('0x' + log.topics[1].slice(26));
                      let amount = 0n;
                      let isGrush = false;

                      // Check topic hash directly to determine isGrush
                      const topic0 = log.topics[0];
                      if (topic0 === '0x2e01df39b7a4eb312b9a7c6c4ea6c4d7ec6be99e19574cd621570d588523c90a' ||
                          topic0 === '0x68f7053e14bf6b672cf8419d143181591a688ca022a665aedce174ed730b8a9a') {
                        isGrush = true;
                      }

                      try {
                        const parsed = routerContract.interface.parseLog(log);
                        if (parsed) {
                          if (parsed.name === 'PredictionDeposited' || parsed.name === 'GrushPredictionDeposited') {
                            const args = parsed.args;
                            // Grab the last element in args which is the amount
                            if (args && args.length > 0) {
                              amount = BigInt(args[args.length - 1]);
                            }
                          }
                        }
                      } catch (_) {
                        // ignore
                      }

                      // Fallback if parsing failed or didn't extract any amount
                      if (amount === 0n) {
                        const dataHex = log.data;
                        if (dataHex && dataHex.length >= 66) {
                          amount = BigInt('0x' + dataHex.slice(2));
                        }
                      }

                      if (amount > 0n) {
                        if (isGrush) {
                          getOrCreateUser(user).grushVolume += amount;
                        } else {
                          getOrCreateUser(user).volume += amount;
                        }
                      }
                    }
                  } catch (e) {
                    // Ignore
                  }
                } else if (addrLower === tokenAddress.toLowerCase()) {
                  // SKIP: GRUSH Transfer events = trading noise, not predictions
                }

              });

              // Advance block pointer chunk-by-chunk to save progress!
              lastFetchedBlockRef.current = to + 1;
              chunksProcessed++;
              setScanState(prev => ({ ...prev, current: to }));

              // Respectful rate limit delay between calls
              await new Promise(resolve => setTimeout(resolve, 80));
            } catch (chunkErr) {
              console.warn(`Failed to query chunk ${from} to ${to}:`, chunkErr);
              break; // Stop and resume next time
            }
          }
          // Mark full scan as done once we reach latest block
          if (lastFetchedBlockRef.current > latestBlock) {
            leaderboardScannedRef.current = true;
            setScanState(prev => ({ ...prev, done: true }));
          }

        }

      } catch (err) {
        console.error("General error in fetchOnChainData:", err);
      }

      setOnChainStats({ ...statsCacheRef.current });
    };

    fetchOnChainData();
    const interval = setInterval(fetchOnChainData, 15000);
    return () => clearInterval(interval);
  }, [activeMatch.id]);

  const fetchUserPrediction = useCallback(async () => {
    if (!walletConnected || !userAddress || !activeMatch.id) {
      setUserPredictions(null);
      return;
    }
    
    try {
      const rpcProvider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
      const queryAbi = [
        "function getUserPredictions(uint256 _matchId, address _user) external view returns (uint256[4] okbAmounts, uint256[4] grushAmounts, bool[4] okbClaimeds, bool[4] grushClaimeds)"
      ];
      const queryContract = new ethers.Contract(HOOK_ADDRESS, queryAbi, rpcProvider);
      const numericId = getNumericMatchId(activeMatch.id);
      const [okbAmounts, grushAmounts, okbClaimeds, grushClaimeds] = await queryContract.getUserPredictions(numericId, userAddress);
      
      const predsObj = {};
      for (let i = 1; i <= 3; i++) {
        predsObj[i] = {
          okbAmount: ethers.formatEther(okbAmounts[i] || 0n),
          grushAmount: ethers.formatEther(grushAmounts[i] || 0n),
          okbClaimed: okbClaimeds[i],
          grushClaimed: grushClaimeds[i]
        };
      }
      setUserPredictions(predsObj);
    } catch (e) {
      console.warn("Failed to fetch user prediction status:", e);
      setUserPredictions(null);
    }
  }, [walletConnected, userAddress, activeMatch.id]);

  useEffect(() => {
    fetchUserPrediction();
    const interval = setInterval(fetchUserPrediction, 8000);
    return () => clearInterval(interval);
  }, [fetchUserPrediction]);

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length > 0) {
      setWalletConnected(true);
      const address = accounts[0];
      setUserAddress(address);
      addLog(`Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`);

      updateBalance(address);
      updateGrushBalance(address);
      const provider = getProvider();
      if (provider) {
        const chain = await provider.request({ method: 'eth_chainId' });
        handleChainChanged(chain);
      }
    } else {
      setWalletConnected(false);
      setUserAddress('');
      setUserBalance('0.00');
      setGrushBalance('0.00');
      addLog('Wallet disconnected.');
    }
  };

  const updateGrushBalance = async (address) => {
    try {
      const provider = getProvider();
      if (!provider) return;

      const tokenAddress = GRUSH_TOKEN_ADDRESS;
      // balanceOf signature is 0x70a08231
      const cleanAddr = address.toLowerCase().replace('0x', '');
      const data = '0x70a08231' + cleanAddr.padStart(64, '0');

      const balanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: tokenAddress,
          data: data
        }, 'latest']
      });

      if (balanceHex && balanceHex !== '0x') {
        const balanceBigInt = BigInt(balanceHex);
        const balanceDec = Number(balanceBigInt) / 10 ** 18;
        setGrushBalance(balanceDec.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      } else {
        setGrushBalance('0.00');
      }
    } catch (e) {
      console.error('Error fetching GRUSH balance:', e);
      setGrushBalance('0.00');
    }
  };

  const handleChainChanged = (hexChainId) => {
    const decChainId = parseInt(hexChainId, 16);
    setChainId(decChainId);
    if (decChainId === 196) {
      addLog('Network switched: OKX X Layer Mainnet');
    } else if (decChainId === 195) {
      addLog('Network switched: OKX X Layer Testnet');
    } else {
      addLog(`Connected to Chain ID ${decChainId}. Please switch to X Layer Mainnet (Chain ID 196).`);
    }
  };

  const updateBalance = async (address) => {
    try {
      const provider = getProvider();
      if (!provider) return;
      const balanceHex = await provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      const balanceDec = parseInt(balanceHex, 16) / 10 ** 18;
      setUserBalance(balanceDec.toFixed(4));
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnectWallet = async () => {
    const provider = getProvider();
    if (!provider) {
      alert('OKX Wallet was not detected. Please install the OKX Wallet extension on your browser or open this page inside the OKX Wallet mobile app.');
      return;
    }
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      handleAccountsChanged(accounts);
    } catch (error) {
      console.error(error);
      addLog('Wallet connection request rejected.');
    }
  };

  const handleDisconnectWallet = () => {
    setWalletConnected(false);
    setUserAddress('');
    setUserBalance('0.00');
    setGrushBalance('0.00');
    setChainId(null);
    addLog('Wallet disconnected by user.');
  };

  const handleSwitchNetwork = async () => {
    const provider = getProvider();
    if (!provider) return;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xc4' }] // 196 is 0xc4
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xc4',
              chainName: 'X Layer Mainnet',
              nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
              rpcUrls: ['https://rpc.xlayer.tech'],
              blockExplorerUrls: ['https://www.okx.com/explorer/xlayer']
            }]
          });
        } catch (addError) {
          console.error(addError);
        }
      }
    }
  };

  const addLog = (message) => {
    setLogs((prev) => [message, ...prev])
  }

  const handleAddGrushToWallet = async () => {
    const provider = getProvider();
    if (!provider) {
      alert("Please connect your OKX Wallet first!");
      return;
    }
    try {
      await provider.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: GRUSH_TOKEN_ADDRESS,
            symbol: 'GRUSH',
            decimals: 18,
            image: `${window.location.origin}/logo.png`
          }
        }
      });
      addLog("GRUSH token registration request sent to OKX Wallet.");
    } catch (err) {
      console.error(err);
      addLog(`Failed to add GRUSH: ${err.message || err}`);
    }
  };

  const copyCA = () => {
    navigator.clipboard.writeText(GRUSH_TOKEN_ADDRESS);
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 2000);
    addLog(`Copied GRUSH CA: ${GRUSH_TOKEN_ADDRESS}`);
  };

  const handlePredictionChange = (teamId) => {
    setPrediction(teamId)
    const selectedTeam = teamId === 1 ? activeMatch.teamA : teamId === 2 ? activeMatch.teamB : 'Draw'
    addLog(`Selected Prediction: ${selectedTeam} ⚽`)

    // Ball and player always reset to the middle!
    setBallPos({ x: 50, y: 50 })
    setPlayerPos({ x: 50, y: 56 })

    // Goalkeeper snaps to the predicted goalpost
    if (teamId === 1) {
      setGkPos({ x: 2, y: 50 }) // left goal
    } else if (teamId === 2) {
      setGkPos({ x: 98, y: 50 }) // right goal
    } else {
      setGkPos({ x: 50, y: 25 }) // center
    }
  }

  const handleSwapAndStrike = async (e) => {
    e.preventDefault()
    console.log("[handleSwapAndStrike] isSelectedMatchOnChain:", isSelectedMatchOnChain, "activeMatch:", activeMatch);
    if (!isSelectedMatchOnChain) {
      setTransactionStatus({ tone: 'warning', message: 'This match is not active on-chain. Select the contract-active match before continuing.' })
      return;
    }
    if (!walletConnected) {
      setTransactionStatus({ tone: 'warning', message: 'Connect your wallet to review and submit this prediction.' })
      return
    }

    if (chainId !== 196) {
      setTransactionStatus({ tone: 'danger', message: 'Wrong network. Switch your wallet to X Layer Mainnet before signing.' })
      return
    }

    const parsedAmount = parseFloat(swapAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransactionStatus({ tone: 'danger', message: 'Enter a valid prediction amount greater than zero.' })
      return
    }

    setIsStriking(true)
    setTransactionStatus({ tone: 'pending', message: 'Waiting for your wallet. Verify the destination, amount, and X Layer network before signing.' })

    try {
      const rawProvider = getProvider();
      if (!rawProvider) throw new Error("No wallet provider detected");
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();

      let tx;
      if (selectedToken === 'GRUSH') {
        const tokenAbi = [
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) external view returns (uint256)"
        ];
        const routerAbi = ["function predictWithGRUSH(uint256 matchId, uint8 predictedTeam, uint256 amount) external"];
        const tokenContract = new ethers.Contract(GRUSH_TOKEN_ADDRESS, tokenAbi, signer);
        const routerContract = new ethers.Contract(ROUTER_ADDRESS, routerAbi, signer);

        const amountWei = ethers.parseEther(swapAmount);
        const currentAllowance = await tokenContract.allowance(userAddress, ROUTER_ADDRESS);

        if (currentAllowance < amountWei) {
          setTransactionStatus({ tone: 'pending', message: `Step 1 of 2: approve exactly ${parsedAmount} GRUSH for the prediction router.` })
          addLog(`[approve] Approving ${parsedAmount} GRUSH for the prediction router...`);
          const approveTx = await tokenContract.approve(ROUTER_ADDRESS, amountWei);
          addLog(`Approval submitted: ${approveTx.hash.slice(0, 10)}... waiting for confirmation`);
          await approveTx.wait();
        } else {
          addLog(`[allowance] Existing allowance (${ethers.formatEther(currentAllowance)} GRUSH) is sufficient. Skipping approval transaction!`);
        }

        const predictionLabel = prediction === 1 ? activeMatch.teamA : prediction === 2 ? activeMatch.teamB : 'Draw';
        addLog(`[predictWithGRUSH] Recording ${parsedAmount} GRUSH prediction for ${predictionLabel}...`);
        const numericMatchId = getNumericMatchId(activeMatch.id);
        tx = await routerContract.predictWithGRUSH(numericMatchId, prediction, amountWei);
      } else {
        const routerAbi = [
          "function predictWithOKB(uint256 matchId, uint8 predictedTeam) external payable"
        ];
        const routerContract = new ethers.Contract(ROUTER_ADDRESS, routerAbi, signer);

        const predictionLabel = prediction === 1 ? activeMatch.teamA : prediction === 2 ? activeMatch.teamB : 'Draw';
        addLog(`[predictWithOKB] Recording ${parsedAmount} OKB prediction for ${predictionLabel}...`);
        const numericMatchId = getNumericMatchId(activeMatch.id);
        tx = await routerContract.predictWithOKB(numericMatchId, prediction, {
          value: ethers.parseEther(swapAmount)
        });
      }

      addLog(`Transaction submitted: ${tx.hash.slice(0, 10)}... waiting for confirmation`);
      setTransactionStatus({ tone: 'pending', message: `Transaction ${tx.hash.slice(0, 10)}... submitted. Waiting for X Layer confirmation.` })
      await tx.wait();
      fetchUserPrediction();
      setTransactionStatus({ tone: 'success', message: 'Prediction confirmed on X Layer. The penalty animation is cosmetic and does not change the on-chain result.' })

      if (selectedToken === 'GRUSH') {
        addLog(`🎉 Transaction confirmed! Prediction jackpot successfully funded with ${parsedAmount} GRUSH.`);
        if (prediction === 1) {
          setTeamAGrushVotes((prev) => prev + parsedAmount);
        } else if (prediction === 2) {
          setTeamBGrushVotes((prev) => prev + parsedAmount);
        } else {
          setTeamDrawGrushVotes((prev) => prev + parsedAmount);
        }
        setGrushJackpot((prev) => prev + parsedAmount);
        try {
          const currentGrushVal = parseFloat(grushBalance.replace(/,/g, ''));
          const nextGrushVal = Math.max(0, currentGrushVal - parsedAmount);
          setGrushBalance(nextGrushVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        } catch (e) { }
      } else {
        addLog(`🎉 Transaction confirmed! Match jackpot successfully funded with ${parsedAmount} OKB.`);
        setJackpot((prev) => prev + parsedAmount);
        setTotalUserVolume((prev) => {
          const next = prev + parsedAmount;
          localStorage.setItem('goalrush_userVolume', next.toString());
          return next;
        });
      }

      // Check if user holds any GRUSH tokens
      const holdsGrush = parseFloat(grushBalance.replace(/,/g, '')) > 0;
      if (holdsGrush) {
        addLog("🟢 GRUSH Holder perk active: 75% penalty shootout success rate boost!");
      }

      // Determine outcome based on probabilities (GRUSH holders: 75% goal / 25% save; others: 50% goal / 50% save)
      const successChance = holdsGrush ? 0.75 : 0.50;
      const isGoalResult = Math.random() < successChance;

      // 1. Set Status to "READY"
      setShootoutStatus('READY 🚨')
      addLog("⚽ Shootout Initiated! Prepare for strike...")
      await new Promise(resolve => setTimeout(resolve, 800))

      // 2. Set Status to "SET"
      setShootoutStatus('SET 🎯')
      await new Promise(resolve => setTimeout(resolve, 800))

      // 3. Set Status to "STRIKE"
      setShootoutStatus('STRIKE ⚽')
      await new Promise(resolve => setTimeout(resolve, 600))
      setShootoutStatus('') // Clear countdown overlay to show action

      // 4. Player runs up to the ball (moves from 56 to 50, 50)
      addLog("🏃 Swapper running up to kick...")
      setPlayerPos({ x: 50, y: 50 })
      await new Promise(resolve => setTimeout(resolve, 400))

      // 5. Kick the ball (it moves halfway and GK starts to move)
      addLog("⚡ Strike launched! Ball in mid-air...")
      let targetX, gkTargetX;
      if (prediction === 1) {
        targetX = 1;
        gkTargetX = 2;
      } else if (prediction === 2) {
        targetX = 99;
        gkTargetX = 98;
      } else {
        targetX = 50;
        gkTargetX = 50;
      }
      const targetY = prediction === 3 ? 15 + Math.random() * 8 : 42 + Math.random() * 16 // final ball Y coordinate

      // Goalkeeper final Y coordinate
      // If Goal, goalkeeper dives far away from the ball. If Save, goalkeeper dives close to the ball.
      let finalGkTargetX = gkTargetX;
      if (prediction === 3 && isGoalResult) {
        finalGkTargetX = 50 + (Math.random() > 0.5 ? -25 : 25);
      }
      const gkTargetY = isGoalResult
        ? targetY + (Math.random() > 0.5 ? -16 : 16)
        : targetY + (Math.random() - 0.5) * 4;

      // Mid-point coordinates from the center circle (50, 50)
      setBallPos({ x: (50 + targetX) / 2, y: (50 + targetY) / 2 })
      setGkPos({ x: (50 + finalGkTargetX) / 2, y: (50 + gkTargetY) / 2 })

      // Dramatic pause at mid-air (slow-mo effect)
      await new Promise(resolve => setTimeout(resolve, 500))

      // 6. Impact: Ball reaches the goal, goalkeeper completes the dive
      setBallPos({ x: targetX, y: targetY })
      setGkPos({ x: finalGkTargetX, y: gkTargetY })

      // Wait for ball to hit target
      await new Promise(resolve => setTimeout(resolve, 300))

      const distance = Math.abs(gkTargetY - targetY)
      const isGoal = distance > 8

      // Haptic shake on pitch card
      const pitchEl = document.querySelector('.pitch-container')
      if (pitchEl) {
        pitchEl.classList.add('pitch-shake')
        setTimeout(() => pitchEl.classList.remove('pitch-shake'), 400)
      }

      if (isGoal) {
        setUserScore((prev) => {
          const next = prev + 1;
          localStorage.setItem('goalrush_userScore', next.toString());
          return next;
        });
        setShowGoalFlash(true)
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 }
        })
        // Extra confetti burst for maximum dopamine rush!
        setTimeout(() => {
          confetti({
            particleCount: 80,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          })
          confetti({
            particleCount: 80,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          })
        }, 300)
        addLog(`⚽ GOAL! Ball hit the back of the net. You scored!`)
      } else {
        setOpponentScore((prev) => prev + 1)
        addLog(`❌ SAVED! Goalkeeper made a stunning save. Swap executed but penalty missed.`)
      }

      // Increment predicted team volume dynamically in state
      if (selectedToken === 'OKB') {
        if (prediction === 1) {
          setTeamAVotes((prev) => prev + parsedAmount);
        } else if (prediction === 2) {
          setTeamBVotes((prev) => prev + parsedAmount);
        } else {
          setTeamDrawVotes((prev) => prev + parsedAmount);
        }
      }

      // Add to prediction history
      const newHistoryEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        match: `${activeMatch.teamA} vs ${activeMatch.teamB}`,
        prediction: prediction === 1 ? activeMatch.teamA : prediction === 2 ? activeMatch.teamB : 'Draw',
        amount: `${parsedAmount} ${selectedToken}`,
        result: isGoal ? 'GOAL ⚽' : 'SAVED ❌'
      }
      setHistory((prev) => {
        const next = [newHistoryEntry, ...prev]
        localStorage.setItem('goalrush_history', JSON.stringify(next))
        return next
      })

      // 7. Reset player, ball, and goalie
      setTimeout(() => {
        setBallPos({ x: 50, y: 50 })
        setPlayerPos({ x: 50, y: 56 })
        if (prediction === 1) {
          setGkPos({ x: 2, y: 50 })
        } else if (prediction === 2) {
          setGkPos({ x: 98, y: 50 })
        } else {
          setGkPos({ x: 50, y: 25 })
        }
        setIsStriking(false)
        setShowGoalFlash(false)
      }, 2500)

    } catch (err) {
      console.error(err);
      const cleanReason = parseRevertReason(err);
      addLog(`❌ Transaction failed: ${cleanReason || err.message || err}`);
      setTransactionStatus({
        tone: 'danger',
        message: cleanReason 
          ? `Transaction reverted: ${cleanReason}`
          : 'Transaction failed. Verify the network, balance, contract address, and wallet message before retrying.'
      })
      setIsStriking(false);
    }
  }

  const handleSelectMatchUI = (match) => {
    setActiveMatch({
      id: match.id,
      dbId: match.dbId,
      startTime: match.startTime,
      teamA: match.teamA,
      teamB: match.teamB,
      flagA: match.flagA || getTeamFifaCode(match.teamA),
      flagB: match.flagB || getTeamFifaCode(match.teamB),
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      minute: match.minute,
      isLive: match.isLive,
      resolved: match.resolved ?? false,
      winner: match.winner ?? 0
    });
    setPrediction(1);
    setBallPos({ x: 50, y: 50 })
    setPlayerPos({ x: 50, y: 56 })
    setGkPos({ x: 2, y: 50 })
    addLog(`Selected Match in UI: ${match.teamA} vs ${match.teamB}`);
  };

  const handleActivateMatchOnChain = async (match) => {
    if (!walletConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      const rawProvider = getProvider();
      if (!rawProvider) throw new Error("No wallet provider detected");
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const abi = [
        "function createMatch(uint256 _matchId, string _teamA, string _teamB, uint256 _duration) external"
      ];
      const hookContract = new ethers.Contract(HOOK_ADDRESS, abi, signer);
      addLog(`[Activate Match] Submitting transaction to activate ${match.teamA} vs ${match.teamB} on-chain...`);

      const numericId = getNumericMatchId(match.id);
      const tx = await hookContract.createMatch(numericId, match.teamA, match.teamB, 24 * 60 * 60);
      addLog(`Transaction submitted: ${tx.hash.slice(0, 10)}... waiting for confirmation`);
      await tx.wait();
      addLog(`🎉 Match (${match.teamA} vs ${match.teamB}) successfully activated on-chain!`);

      setActiveMatch({
        id: match.id,
        teamA: match.teamA,
        teamB: match.teamB,
        resolved: false,
        winner: 0
      });
      setPrediction(1);
      setBallPos({ x: 50, y: 50 })
      setPlayerPos({ x: 50, y: 56 })
      setGkPos({ x: 2, y: 50 })
    } catch (err) {
      console.error(err);
      addLog(`❌ Activation failed: ${err.reason || err.message || err}`);
      alert(`Activation failed. Only the contract owner can change the active match. Details: ${err.reason || err.message || err}`);
    }
  };

  const handleClaimJackpot = async () => {
    if (!walletConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      const rawProvider = getProvider();
      if (!rawProvider) throw new Error("No wallet provider detected");
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const abi = [
        "function claimJackpot(uint256 _matchId) external"
      ];
      const hookContract = new ethers.Contract(HOOK_ADDRESS, abi, signer);
      const numericMatchId = getNumericMatchId(activeMatch.id);
      addLog(`[claimJackpot] Claiming jackpot for Match #${activeMatch.id} (on-chain ID: ${numericMatchId.toString()})...`);

      const tx = await hookContract.claimJackpot(numericMatchId);
      addLog(`Transaction submitted: ${tx.hash.slice(0, 10)}... waiting for confirmation`);
      await tx.wait();
      fetchUserPrediction();
      addLog(`🎉 Jackpot claimed successfully! Shares of the jackpot have been transferred to your wallet.`);
      alert("Jackpot claimed successfully!");
    } catch (err) {
      console.error(err);
      addLog(`❌ Claim failed: ${err.reason || err.message || err}`);
      alert(`Claim failed. Make sure the match is resolved, you predicted the winner correctly, and you have not claimed yet.`);
    }
  };

  const handleClaimGrushJackpot = async () => {
    if (!walletConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      const rawProvider = getProvider();
      if (!rawProvider) throw new Error("No wallet provider detected");
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const abi = [
        "function claimGrushJackpot(uint256 _matchId) external"
      ];
      const hookContract = new ethers.Contract(HOOK_ADDRESS, abi, signer);
      const numericMatchId = getNumericMatchId(activeMatch.id);
      addLog(`[claimGrushJackpot] Claiming GRUSH jackpot for Match #${activeMatch.id} (on-chain ID: ${numericMatchId.toString()})...`);

      const tx = await hookContract.claimGrushJackpot(numericMatchId);
      addLog(`Transaction submitted: ${tx.hash.slice(0, 10)}... waiting for confirmation`);
      await tx.wait();
      fetchUserPrediction();
      addLog(`GRUSH jackpot claimed successfully! Token shares have been transferred to your wallet.`);
      updateGrushBalance(userAddress);
      alert("GRUSH jackpot claimed successfully!");
    } catch (err) {
      console.error(err);
      addLog(`GRUSH claim failed: ${err.reason || err.message || err}`);
      alert(`GRUSH claim failed. Make sure the match is resolved, you predicted the winner correctly, and you have not claimed yet.`);
    }
  };

  const copyCode = (codeText) => {
    navigator.clipboard.writeText(codeText)
    alert('Code copied to clipboard!')
  }

  return (
    <div className="app-wrapper">
      <a className="skip-link" href="#dashboard">Skip to prediction dashboard</a>
      <div className="bg-ambient-glow"></div>

      {/* Header / Navbar */}
      <header className="navbar">
        <div className="logo-wrap">
          <span className="logo-icon">⚽</span>
          <h1 className="logo-text">GoalRush</h1>
        </div>
        <nav>
          <ul className="nav-links">
            <li>
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
              >
                Dashboard
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('match-center')}
                className={`nav-btn ${currentView === 'match-center' ? 'active' : ''}`}
              >
                Match Center
              </button>
            </li>
            <li>
              <a
                href="#leaderboard"
                className="nav-btn-link"
                onClick={() => setCurrentView('dashboard')}
              >
                Leaderboard
              </a>
            </li>
            <li>
              <a
                href="#about"
                className="nav-btn-link"
                onClick={() => setCurrentView('dashboard')}
              >
                About
              </a>
            </li>
          </ul>
        </nav>
        <div className="nav-actions">
          {chainId !== null ? (
            chainId === 196 ? (
              <div className="badge-xlayer" style={{ color: 'var(--color-primary)' }}>
                <span className="badge-dot" style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary)' }}></span>
                X Layer Mainnet
              </div>
            ) : chainId === 195 ? (
              <div className="badge-xlayer" style={{ color: '#ffcc00' }}>
                <span className="badge-dot" style={{ backgroundColor: '#ffcc00', boxShadow: '0 0 8px #ffcc00' }}></span>
                X Layer Testnet
              </div>
            ) : (
              <button className="badge-xlayer" onClick={handleSwitchNetwork} style={{ cursor: 'pointer', background: 'rgba(255, 51, 68, 0.1)', borderColor: '#ff3344', color: '#ff3344' }}>
                <AlertTriangle size={12} />
                Switch to X Layer
              </button>
            )
          ) : (
            <div className="badge-xlayer">
              <span className="badge-dot" style={{ backgroundColor: '#666' }}></span>
              Not Connected
            </div>
          )}

          {walletConnected ? (
            <div className="wallet-connected-wrapper">
              <div
                className={`btn-secondary ${parseFloat(grushBalance.replace(/,/g, '')) > 0 ? 'text-glow-green' : ''}`}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'default',
                  borderColor: parseFloat(grushBalance.replace(/,/g, '')) > 0 ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.08)',
                  background: parseFloat(grushBalance.replace(/,/g, '')) > 0 ? 'rgba(157, 255, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)'
                }}
              >
                <User size={14} />
                <span>
                  {userAddress.slice(0, 6)}...{userAddress.slice(-4)} ({userBalance} OKB
                  {parseFloat(grushBalance.replace(/,/g, '')) > 0 && ` | ⚽ ${grushBalance} GRUSH`}
                  )
                </span>
              </div>
              <button
                className="btn-secondary"
                onClick={handleDisconnectWallet}
                style={{
                  padding: '8px 12px',
                  fontSize: '0.9rem',
                  color: 'var(--color-danger)',
                  borderColor: 'rgba(255, 51, 68, 0.2)',
                  background: 'rgba(255, 51, 68, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <LogOut size={14} />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                <button
                  type="button"
                  onClick={() => {
                    setWalletConnected(true);
                    setUserAddress('0xae1b810ffb88855ffd967dc274d9ba4fadd21990');
                    setUserBalance('0.1500');
                    setGrushBalance('500.00');
                    setChainId(196);
                    addLog('Simulating wallet: 0xae1b... (Winner prediction)');
                  }}
                  className="btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: '#9dff00', color: '#9dff00', background: 'rgba(157, 255, 0, 0.05)', cursor: 'pointer' }}
                >
                  Simulate Wallet 🧪
                </button>
              )}
              <button className="btn-primary" onClick={handleConnectWallet} style={{ padding: '8px 16px', fontSize: '0.9rem', cursor: 'pointer' }}>
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </header>

      {currentView === 'dashboard' && (
        <>
          {/* Hackathon Hero Section */}
          <section className="hackathon-hero-container">
            <div className="hackathon-left">
              <div className="hackathon-title-group">
                <div className="hero-logo-wrapper" style={{
                  display: 'inline-flex',
                  padding: '16px',
                  borderRadius: '24px',
                  background: '#000000',
                  border: '1px solid rgba(157, 255, 0, 0.2)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(157, 255, 0, 0.08)',
                  marginBottom: '24px',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <img
                    src="/logo.png?v=2"
                    alt="Goal Rush Logo"
                    className="hero-logo-img"
                    style={{
                      maxHeight: '180px',
                      width: 'auto',
                      display: 'block',
                      mixBlendMode: 'screen',
                      filter: 'contrast(1.6) brightness(0.9) saturate(1.2)'
                    }}
                  />
                </div>
              </div>
              <p className="hackathon-desc">
                GoalRush is a sports prediction experience on X Layer. Fund a match pick through the prediction router, follow live fixtures, and play a cosmetic penalty challenge after confirmation.
              </p>
              <div className="security-status-card" role="note" aria-label="Protocol security status">
                <div className="security-status-icon"><ShieldCheck size={20} /></div>
                <div>
                  <strong>Mainnet beta, not audited</strong>
                  <span>Verify the contract address and transaction amount in your wallet. GoalRush will never ask for a seed phrase or tell you to bypass a wallet warning.</span>
                </div>
                <a href={`https://www.okx.com/explorer/xlayer/address/${HOOK_ADDRESS}`} target="_blank" rel="noopener noreferrer">
                  Verify contract <ExternalLink size={14} />
                </a>
              </div>
              <div className="hackathon-actions">
                <a href="#dashboard" className="btn-primary">
                  <Play size={18} fill="currentColor" /> Try Live Swap
                </a>
                <a
                  href="https://eulr.fun/token/0x422fe165b2da990d18c6dca944b11dcd61519671"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderColor: 'rgba(0, 229, 255, 0.4)' }}
                >
                  📈 Trade GRUSH on Eulr
                </a>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowDevPortal(true);
                    setTimeout(() => {
                      document.getElementById('contracts')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <Code size={18} /> View Hook Contract
                </button>
              </div>

              {/* Cyber Info Panel */}
              <div className="hero-info-grid">
                <div className="hero-info-card">
                  <div className="hero-info-card-header">
                    <Globe size={13} className="hero-info-card-icon" />
                    <span>NETWORK</span>
                  </div>
                  <div className="hero-info-card-value">OKX X Layer</div>
                </div>

                <div className="hero-info-card clickable" onClick={() => {
                  navigator.clipboard.writeText(HOOK_ADDRESS);
                  alert('Hook address copied to clipboard!');
                }}>
                  <div className="hero-info-card-header">
                    <Code size={13} className="hero-info-card-icon" style={{ color: 'var(--color-primary)' }} />
                    <span>HOOK CONTRACT</span>
                  </div>
                  <div className="hero-info-card-value font-mono">
                    {HOOK_ADDRESS.slice(0, 6)}...{HOOK_ADDRESS.slice(-4)}
                    <Copy size={11} className="copy-hint-icon" />
                  </div>
                </div>

                <div className="hero-info-card clickable" onClick={() => {
                  navigator.clipboard.writeText(GRUSH_TOKEN_ADDRESS);
                  alert('GRUSH token address copied to clipboard!');
                }}>
                  <div className="hero-info-card-header">
                    <Coins size={13} className="hero-info-card-icon" style={{ color: 'var(--color-secondary)' }} />
                    <span>GRUSH TOKEN</span>
                  </div>
                  <div className="hero-info-card-value font-mono">
                    {GRUSH_TOKEN_ADDRESS.slice(0, 6)}...{GRUSH_TOKEN_ADDRESS.slice(-4)}
                    <Copy size={11} className="copy-hint-icon" />
                  </div>
                </div>

                <div className="hero-info-card">
                  <div className="hero-info-card-header">
                    <Activity size={13} className="hero-info-card-icon" />
                    <span>CALLBACKS</span>
                  </div>
                  <div className="hero-info-card-value">Swap Triggers</div>
                </div>

                <div className="hero-info-card">
                  <div className="hero-info-card-header">
                    <Flame size={13} className="hero-info-card-icon" style={{ color: 'var(--color-accent)' }} />
                    <span>GOAL ODDS</span>
                  </div>
                  <div className="hero-info-card-value">5% Chance</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Community:</span>
                <a
                  href="https://x.com/goalrushdotfun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.15)', cursor: 'pointer', borderRadius: '8px' }}
                >
                  <Twitter size={14} /> Twitter / X
                </a>
                <a
                  href="https://t.me/+qwzA9MrSA3I2OTk9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.15)', cursor: 'pointer', borderRadius: '8px' }}
                >
                  <Send size={14} /> Telegram
                </a>
              </div>
            </div>

            {/* Cyber-Matrix Right Column */}
            <div className="hackathon-right">
              <div className="ascii-ball-wrapper">
                <div className="ascii-code-graphic">
                  {asciiArtText}
                </div>
                <div className="ascii-glow-effect"></div>
                <div className="interactive-3d-overlay">
                  <SoccerBall3D />
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Dashboard / Simulator */}
          <section id="dashboard" className="dashboard-grid">
            {/* Left Side: Soccer Pitch Simulation */}
            <div className="card-bezel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 className="panel-title">
                  <TerminalIcon size={20} style={{ color: 'var(--color-primary)' }} />
                  GoalRush Pitch Simulator
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
                  Submit a funded prediction through the router, then play the cosmetic shootout while the on-chain result remains verifiable.
                </p>
              </div>

              <div className="pitch-container">
                {shootoutStatus && (
                  <div className="shootout-overlay">
                    <div className="shootout-text-main">{shootoutStatus}</div>
                  </div>
                )}
                <div className="pitch-lines"></div>
                <div className="pitch-midline"></div>
                <div className="pitch-midcircle"></div>
                <div className="pitch-box-left"></div>
                <div className="pitch-box-right"></div>
                <div className="goal-post-left"></div>
                <div className="goal-post-right"></div>

                {/* Score overlay */}
                <div className="pitch-score-overlay">
                  <span style={{ color: 'var(--color-primary)' }}>SWAPPER: {userScore}</span>
                  <span>vs</span>
                  <span style={{ color: 'var(--color-danger)' }}>GK: {opponentScore}</span>
                </div>

                {/* Goal Flash */}
                <div className={`pitch-goal-flash ${showGoalFlash ? 'active' : ''}`}>
                  <div className="pitch-goal-text">GOAL!!</div>
                </div>

                <div
                  className="pitch-ball"
                  style={{
                    left: `${ballPos.x}%`,
                    top: `${ballPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    animation: isStriking ? 'spin-slow 0.4s linear infinite' : 'none'
                  }}
                >
                  ⚽
                </div>

                {/* Goalkeeper */}
                <div
                  className="pitch-player opponent"
                  style={{ left: `${gkPos.x}%`, top: `${gkPos.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  GK
                </div>

                {/* Swapper / Player */}
                <div
                  className="pitch-player"
                  style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  P
                </div>
              </div>

              {/* Swap Box */}
              <form className="swap-widget" onSubmit={handleSwapAndStrike}>
                {/* Token Selector */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedToken('OKB');
                      setSwapAmount('0.001');
                    }}
                    className={`btn-secondary ${selectedToken === 'OKB' ? 'active' : ''}`}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      border: `1px solid ${selectedToken === 'OKB' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)'}`,
                      background: selectedToken === 'OKB' ? 'rgba(157, 255, 0, 0.08)' : 'rgba(255,255,255,0.03)',
                      color: selectedToken === 'OKB' ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    disabled={isStriking}
                  >
                    native OKB
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedToken('GRUSH');
                      setSwapAmount('100');
                    }}
                    className={`btn-secondary ${selectedToken === 'GRUSH' ? 'active' : ''}`}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      border: `1px solid ${selectedToken === 'GRUSH' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)'}`,
                      background: selectedToken === 'GRUSH' ? 'rgba(157, 255, 0, 0.08)' : 'rgba(255,255,255,0.03)',
                      color: selectedToken === 'GRUSH' ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    disabled={isStriking}
                  >
                    GRUSH Token
                  </button>
                </div>

                <div className="swap-input-row">
                  <div className="swap-input-container">
                    <div className="swap-label">Prediction Size (Ticket Cost)</div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={swapAmount}
                        onChange={(e) => setSwapAmount(e.target.value)}
                        className="swap-input"
                        disabled={isStriking}
                        step={selectedToken === 'GRUSH' ? '1' : '0.0001'}
                        min={selectedToken === 'GRUSH' ? '1' : '0.0001'}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>{selectedToken}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      {selectedToken === 'GRUSH' ? (
                        <>
                          <button type="button" onClick={() => setSwapAmount('10')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', cursor: 'pointer' }} disabled={isStriking}>10 GRUSH</button>
                          <button type="button" onClick={() => setSwapAmount('100')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', cursor: 'pointer' }} disabled={isStriking}>100 GRUSH</button>
                          <button type="button" onClick={() => setSwapAmount('1000')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', cursor: 'pointer' }} disabled={isStriking}>1,000 GRUSH</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => setSwapAmount('0.0001')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', cursor: 'pointer' }} disabled={isStriking}>0.0001 OKB</button>
                          <button type="button" onClick={() => setSwapAmount('0.001')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', cursor: 'pointer' }} disabled={isStriking}>0.001 OKB</button>
                          <button type="button" onClick={() => setSwapAmount('0.01')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', cursor: 'pointer' }} disabled={isStriking}>0.01 OKB</button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="swap-input-container">
                    <div className="swap-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>Jackpot Share Weight</span>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'normal' }}>
                        100% of prediction tokens fund the match jackpot pool
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="swap-input" style={{ opacity: 0.8 }}>
                        {parseFloat(swapAmount) ? parseFloat(swapAmount).toFixed(selectedToken === 'GRUSH' ? 0 : 4) : '0'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)' }}>{selectedToken}</span>
                    </div>
                  </div>
                </div>

                {/* ─── WINNER-ONLY CLAIM PANEL ─────────────────────────────────────
                    Rules (applies to ALL on-chain matches, now and future):
                    • Not resolved yet → nothing shown (let them predict / wait)
                    • Resolved + user won + unclaimed → show Claim button(s)
                    • Resolved + user won + already claimed → show quiet ✅ badge
                    • Resolved + user lost → nothing shown (no clutter, no shame)
                    • No prediction / wallet not connected → nothing shown
                ─────────────────────────────────────────────────────────────── */}
                {isSelectedMatchOnChain && walletConnected && userPredictions && activeMatch.resolved && activeMatch.winner > 0 && (parseFloat(userPredictions[activeMatch.winner]?.okbAmount) > 0 || parseFloat(userPredictions[activeMatch.winner]?.grushAmount) > 0) && (
                  <div style={{
                    marginTop: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    {/* OKB Claim */}
                    {parseFloat(userPredictions[activeMatch.winner]?.okbAmount) > 0 && (
                      userPredictions[activeMatch.winner]?.okbClaimed ? (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          background: 'rgba(157, 255, 0, 0.06)', border: '1px solid rgba(157, 255, 0, 0.2)',
                          borderRadius: '10px', padding: '10px 14px',
                          fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)'
                        }}>
                          ✅ OKB Jackpot claimed
                        </div>
                      ) : (
                        <button
                          type="button"
                          id="claim-okb-jackpot-btn"
                          onClick={handleClaimJackpot}
                          className="swap-btn"
                          style={{
                            background: 'linear-gradient(135deg, #00e5ff 0%, #9dff00 100%)',
                            color: '#000', fontWeight: 800, fontSize: '1rem',
                            boxShadow: '0 0 20px rgba(0, 229, 255, 0.35)',
                            letterSpacing: '0.3px'
                          }}
                        >
                          💰 Claim OKB Jackpot · {parseFloat(userPredictions[activeMatch.winner]?.okbAmount).toFixed(4)} OKB
                        </button>
                      )
                    )}
                    {/* GRUSH Claim */}
                    {parseFloat(userPredictions[activeMatch.winner]?.grushAmount) > 0 && (
                      userPredictions[activeMatch.winner]?.grushClaimed ? (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          background: 'rgba(0, 229, 255, 0.06)', border: '1px solid rgba(0, 229, 255, 0.2)',
                          borderRadius: '10px', padding: '10px 14px',
                          fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-secondary)'
                        }}>
                          ✅ GRUSH Jackpot claimed
                        </div>
                      ) : (
                        <button
                          type="button"
                          id="claim-grush-jackpot-btn"
                          onClick={handleClaimGrushJackpot}
                          className="swap-btn"
                          style={{
                            background: 'linear-gradient(135deg, #9dff00 0%, #c6ff00 100%)',
                            color: '#000', fontWeight: 800, fontSize: '1rem',
                            boxShadow: '0 0 20px rgba(157, 255, 0, 0.35)',
                            letterSpacing: '0.3px'
                          }}
                        >
                          ⚽ Claim GRUSH Jackpot · {parseFloat(userPredictions[activeMatch.winner]?.grushAmount).toFixed(0)} GRUSH
                        </button>
                      )
                    )}
                  </div>
                )}


                {/* ─── CHECK PAST MATCH CLAIMS ─── */}
                {walletConnected && (
                  <div style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      onClick={() => setShowPastClaimChecker(p => !p)}
                      style={{
                        width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>🔍 Check Past Match Claims</span>
                      <span style={{ transform: showPastClaimChecker ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                    </button>

                    {showPastClaimChecker && (
                      <div style={{
                        marginTop: '8px', padding: '14px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                          Select a past match or enter its ID to check your prediction & claim status:
                        </div>

                        {/* Quick-select past matches */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {knownPastMatches.map(pm => (
                            <button
                              key={pm.matchId}
                              type="button"
                              onClick={() => { setPastMatchInput(pm.matchId); handleCheckPastClaim(pm.matchId); }}
                              className="btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer', minWidth: 'auto' }}
                            >
                              {pm.label}
                            </button>
                          ))}
                        </div>

                        {/* Manual ID input */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            value={pastMatchInput}
                            onChange={e => setPastMatchInput(e.target.value)}
                            placeholder="Match ID (e.g. espn_760432)"
                            style={{
                              flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '0.78rem',
                              fontFamily: 'var(--font-mono)', outline: 'none'
                            }}
                            onKeyDown={e => e.key === 'Enter' && handleCheckPastClaim(pastMatchInput)}
                          />
                          <button
                            type="button"
                            onClick={() => handleCheckPastClaim(pastMatchInput)}
                            className="btn-primary"
                            disabled={pastClaimLoading}
                            style={{ padding: '8px 14px', fontSize: '0.78rem', minWidth: 'auto' }}
                          >
                            {pastClaimLoading ? '...' : 'Check'}
                          </button>
                        </div>

                        {/* Result display */}
                        {pastClaimResult && (
                          <div style={{
                            padding: '12px', borderRadius: '8px',
                            background: pastClaimResult.error ? 'rgba(255,50,50,0.06)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${pastClaimResult.error ? 'rgba(255,50,50,0.2)' : 'rgba(255,255,255,0.1)'}`,
                            fontSize: '0.82rem'
                          }}>
                            {pastClaimResult.error ? (
                              <div style={{ color: 'rgba(255,100,100,0.9)' }}>{pastClaimResult.error}</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ color: '#fff', fontWeight: 700 }}>
                                  {pastClaimResult.teamA} vs {pastClaimResult.teamB}
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>
                                  Status: {pastClaimResult.resolved
                                    ? <span style={{ color: 'var(--color-primary)' }}>Resolved · Winner: {pastClaimResult.winner === 1 ? pastClaimResult.teamA : pastClaimResult.winner === 2 ? pastClaimResult.teamB : pastClaimResult.winner === 3 ? 'Draw' : 'None'}</span>
                                    : <span style={{ color: '#ffb300' }}>Not resolved yet</span>
                                  }
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>
                                  Jackpot: {parseFloat(pastClaimResult.jackpot).toFixed(4)} OKB
                                </div>

                                {!pastClaimResult.hasPrediction ? (
                                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                                    No prediction found from your wallet on this match.
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>
                                      Your pick: <strong style={{ color: '#fff' }}>{pastClaimResult.predictedTeam === 1 ? pastClaimResult.teamA : pastClaimResult.predictedTeam === 2 ? pastClaimResult.teamB : 'Draw'}</strong>
                                      {parseFloat(pastClaimResult.okbAmount) > 0 && ` · ${parseFloat(pastClaimResult.okbAmount).toFixed(4)} OKB`}
                                      {parseFloat(pastClaimResult.grushAmount) > 0 && ` · ${parseFloat(pastClaimResult.grushAmount).toFixed(0)} GRUSH`}
                                    </div>

                                    {pastClaimResult.isWinner ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {parseFloat(pastClaimResult.okbAmount) > 0 && (
                                          pastClaimResult.okbClaimed
                                            ? <div style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.8rem' }}>✅ OKB Jackpot already claimed</div>
                                            : <button type="button" onClick={() => handleClaimPastOkb(pastClaimResult.numericId)} className="swap-btn" style={{ background: 'linear-gradient(135deg, #00e5ff, #9dff00)', color: '#000', fontWeight: 800, fontSize: '0.9rem' }}>💰 Claim OKB Jackpot</button>
                                        )}
                                        {parseFloat(pastClaimResult.grushAmount) > 0 && (
                                          pastClaimResult.grushClaimed
                                            ? <div style={{ color: 'var(--color-secondary)', fontWeight: 600, fontSize: '0.8rem' }}>✅ GRUSH Jackpot already claimed</div>
                                            : <button type="button" onClick={() => handleClaimPastGrush(pastClaimResult.numericId)} className="swap-btn" style={{ background: 'linear-gradient(135deg, #9dff00, #c6ff00)', color: '#000', fontWeight: 800, fontSize: '0.9rem' }}>⚽ Claim GRUSH Jackpot</button>
                                        )}
                                      </div>
                                    ) : pastClaimResult.resolved ? (
                                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
                                        No winning prediction on this match.
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {typeof activeMatch.id === 'string' && activeMatch.id.startsWith('api-') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <div style={{
                      background: 'rgba(0, 229, 255, 0.04)',
                      border: '1px solid rgba(0, 229, 255, 0.25)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center'
                    }}>
                      <h4 style={{ color: 'var(--color-secondary)', margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700 }}>🌍 REAL-TIME LIVE TRACKING</h4>
                      <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.85rem', margin: 0 }}>
                        This match is a live fixture fetched in real-time from the football API.
                      </p>
                      <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', marginTop: '8px', marginBottom: 0 }}>
                        Predictions and shootout games are available only on contract-active World Cup matches.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeOnChainMatchRef.current) {
                          handleSelectMatchUI(activeOnChainMatchRef.current);
                        } else {
                          handleSelectMatchUI({ id: 1, teamA: 'Canada', teamB: 'Bosnia & Herzegovina' });
                        }
                      }}
                      className="swap-btn"
                      style={{ background: 'var(--color-primary)', color: '#000', fontWeight: 'bold' }}
                    >
                      Switch to Active Prediction Match ⚽
                    </button>
                  </div>
                ) : (activeMatch.resolved || activeMatch.minute === 'FT' || (isSelectedMatchOnChain && activeMatch.resolved)) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                      <div style={{
                        background: 'rgba(157, 255, 0, 0.04)',
                        border: '1px solid rgba(157, 255, 0, 0.25)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                      }}>
                        <h4 style={{ color: 'var(--color-primary)', margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700 }}>🏆 MATCH STATUS</h4>
                        <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.85rem', margin: 0 }}>
                          <strong>{activeMatch.teamA}</strong> {activeMatch.scoreA ?? '?'} – {activeMatch.scoreB ?? '?'} <strong>{activeMatch.teamB}</strong>
                        </p>
                        <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem', marginTop: '6px', marginBottom: 0 }}>
                          Result: <strong style={{ color: 'var(--color-secondary)' }}>
                            {(() => {
                              if (isSelectedMatchOnChain) {
                                if (!activeMatch.resolved) return 'Pending Resolution';
                                return activeMatch.winner === 1 
                                  ? `${activeMatch.teamA} Wins` 
                                  : activeMatch.winner === 2 
                                    ? `${activeMatch.teamB} Wins` 
                                    : 'Draw';
                              }
                              if (activeMatch.scoreA > activeMatch.scoreB) {
                                return `${activeMatch.teamA} Wins`;
                              } else if (activeMatch.scoreB > activeMatch.scoreA) {
                                return `${activeMatch.teamB} Wins`;
                              } else {
                                return 'Draw';
                              }
                            })()}
                          </strong>
                        </p>
                        <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.72rem', marginTop: '8px', marginBottom: 0 }}>
                          {isSelectedMatchOnChain 
                            ? `On-chain Match · Jackpot: ${jackpot.toFixed(4)} OKB`
                            : 'This is a local simulation match. On-chain claims require the contract-active match.'
                          }
                        </p>
                      </div>
                      {/* Claim buttons handled by winner-only panel above */}

                    <button
                      type="button"
                      onClick={() => {
                        // Find a live match to switch to
                        const liveM = liveMatchesRef.current.find(m => m.isLive && m.minute !== 'FT');
                        if (liveM) {
                          handleSelectMatchUI(liveM);
                        } else if (activeOnChainMatchRef.current) {
                          handleSelectMatchUI(activeOnChainMatchRef.current);
                        }
                      }}
                      className="swap-btn"
                      style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.15)' }}
                    >
                      Switch to Live Match ⚽
                    </button>
                  </div>
                ) : (!activeMatch.isLive && activeMatch.minute !== 'FT' && activeMatch.startTime && (activeMatch.startTime - Date.now() > 24 * 60 * 60 * 1000)) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <div style={{
                      background: 'rgba(255, 179, 0, 0.04)',
                      border: '1px solid rgba(255, 179, 0, 0.25)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center'
                    }}>
                      <h4 style={{ color: '#ffb300', margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700 }}>📅 UPCOMING MATCH</h4>
                      <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.85rem', margin: 0 }}>
                        {activeMatch.teamA} vs {activeMatch.teamB} starts in more than 24 hours.
                      </p>
                      <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', marginTop: '8px', marginBottom: 0 }}>
                        Predictions open 24 hours before kickoff. Switch to an active match below.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const liveM = liveMatchesRef.current.find(m => m.isLive && m.minute !== 'FT');
                        if (liveM) {
                          handleSelectMatchUI(liveM);
                        } else if (activeOnChainMatchRef.current) {
                          handleSelectMatchUI(activeOnChainMatchRef.current);
                        }
                      }}
                      className="swap-btn"
                      style={{ background: 'var(--color-primary)', color: '#000', fontWeight: 'bold' }}
                    >
                      Switch to Live Match ⚽
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Select Team Prediction */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="swap-label" style={{ marginBottom: '8px' }}>Attach Match Winner Prediction (via hookData)</div>
                      <div className="prediction-choice-container">
                        <button
                          type="button"
                          onClick={() => handlePredictionChange(1)}
                          className={`prediction-choice-btn ${prediction === 1 ? 'active' : ''}`}
                          disabled={isStriking}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {activeMatch.teamA} <img src={getFlagUrl(activeMatch.flagA || getTeamFifaCode(activeMatch.teamA))} alt={activeMatch.teamA} style={{ width: '14px', height: '10px', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)' }} />
                            </span>
                            {userPredictions && (parseFloat(userPredictions[1]?.okbAmount) > 0 || parseFloat(userPredictions[1]?.grushAmount) > 0) && (
                              <span style={{ fontSize: '0.7rem', opacity: 0.9, color: 'var(--color-primary)', fontWeight: 600 }}>
                                Predicted: {parseFloat(userPredictions[1]?.okbAmount) > 0 ? `${parseFloat(userPredictions[1]?.okbAmount).toFixed(3)} OKB` : ''}
                                {parseFloat(userPredictions[1]?.okbAmount) > 0 && parseFloat(userPredictions[1]?.grushAmount) > 0 ? ' + ' : ''}
                                {parseFloat(userPredictions[1]?.grushAmount) > 0 ? `${parseFloat(userPredictions[1]?.grushAmount).toFixed(0)} GRUSH` : ''}
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePredictionChange(3)}
                          className={`prediction-choice-btn ${prediction === 3 ? 'active' : ''}`}
                          disabled={isStriking}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              Draw 🤝
                            </span>
                            {userPredictions && (parseFloat(userPredictions[3]?.okbAmount) > 0 || parseFloat(userPredictions[3]?.grushAmount) > 0) && (
                              <span style={{ fontSize: '0.7rem', opacity: 0.9, color: 'var(--color-primary)', fontWeight: 600 }}>
                                Predicted: {parseFloat(userPredictions[3]?.okbAmount) > 0 ? `${parseFloat(userPredictions[3]?.okbAmount).toFixed(3)} OKB` : ''}
                                {parseFloat(userPredictions[3]?.okbAmount) > 0 && parseFloat(userPredictions[3]?.grushAmount) > 0 ? ' + ' : ''}
                                {parseFloat(userPredictions[3]?.grushAmount) > 0 ? `${parseFloat(userPredictions[3]?.grushAmount).toFixed(0)} GRUSH` : ''}
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePredictionChange(2)}
                          className={`prediction-choice-btn ${prediction === 2 ? 'active' : ''}`}
                          disabled={isStriking}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {activeMatch.teamB} <img src={getFlagUrl(activeMatch.flagB || getTeamFifaCode(activeMatch.teamB))} alt={activeMatch.teamB} style={{ width: '14px', height: '10px', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)' }} />
                            </span>
                            {userPredictions && (parseFloat(userPredictions[2]?.okbAmount) > 0 || parseFloat(userPredictions[2]?.grushAmount) > 0) && (
                              <span style={{ fontSize: '0.7rem', opacity: 0.9, color: 'var(--color-primary)', fontWeight: 600 }}>
                                Predicted: {parseFloat(userPredictions[2]?.okbAmount) > 0 ? `${parseFloat(userPredictions[2]?.okbAmount).toFixed(3)} OKB` : ''}
                                {parseFloat(userPredictions[2]?.okbAmount) > 0 && parseFloat(userPredictions[2]?.grushAmount) > 0 ? ' + ' : ''}
                                {parseFloat(userPredictions[2]?.grushAmount) > 0 ? `${parseFloat(userPredictions[2]?.grushAmount).toFixed(0)} GRUSH` : ''}
                              </span>
                            )}
                          </span>
                        </button>
                      </div>
                    </div>

                    <button
                      type={walletConnected ? "submit" : "button"}
                      className="swap-btn"
                      disabled={isStriking || (walletConnected && chainId !== 196)}
                      onClick={!walletConnected ? handleConnectWallet : undefined}
                    >
                      {isStriking ? 'Transaction in progress...' : !walletConnected ? 'Connect Wallet to Continue' : chainId !== 196 ? 'Switch to X Layer Mainnet' : 'Review & Submit Prediction'}
                    </button>

                    <div className={`transaction-status ${transactionStatus.tone}`} role="status" aria-live="polite">
                      <div className="transaction-review-grid">
                        <span>Match<strong>{activeMatch.teamA} vs {activeMatch.teamB}</strong></span>
                        <span>Your pick<strong>{prediction === 1 ? activeMatch.teamA : prediction === 2 ? activeMatch.teamB : 'Draw'}</strong></span>
                        <span>Maximum spend<strong>{swapAmount || '0'} {selectedToken} + gas</strong></span>
                        <span>Network<strong>{chainId === 196 ? 'X Layer Mainnet' : 'Switch required'}</strong></span>
                      </div>
                      <p>{transactionStatus.message}</p>
                      <small>If your wallet marks the transaction suspicious or unsafe, cancel it. Verify the router and hook addresses independently before retrying.</small>
                    </div>
                  </>
                )}

                {/* GRUSH Token Hub Card */}
                <div style={{
                  marginTop: '20px',
                  padding: '14px',
                  background: 'rgba(157, 255, 0, 0.02)',
                  border: '1px solid rgba(157, 255, 0, 0.12)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Coins size={16} style={{ color: 'var(--color-primary)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>
                        GRUSH Token Hub
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      background: 'rgba(157, 255, 0, 0.1)',
                      color: 'var(--color-primary)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}>
                      X Layer CA
                    </span>
                  </div>

                  {/* Contract Address row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'rgba(255,255,255,0.6)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '180px'
                    }}>
                      {GRUSH_TOKEN_ADDRESS}
                    </span>
                    <button
                      type="button"
                      onClick={copyCA}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: caCopied ? 'var(--color-primary)' : 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Copy size={12} />
                      {caCopied ? 'Copied!' : 'Copy CA'}
                    </button>
                  </div>

                  {/* Quick actions grid */}
                  <div className="grush-hub-actions" style={{ display: 'grid', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleAddGrushToWallet}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#fff',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Plus size={14} style={{ color: 'var(--color-primary)' }} />
                      Add to OKX Wallet
                    </button>

                    <a
                      href="https://dapp.quickswap.exchange/swap?type=v4&from=ETH&to=0x422fe165B2Da990d18c6Dca944b11dcD61519671"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#fff',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      <ExternalLink size={14} style={{ color: 'var(--color-secondary)' }} />
                      Trade on QuickSwap
                    </a>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: '1.4' }}>
                  <span>ℹ️ This simulator runs a test interaction with the V4 hook on-chain to play the shootout and record predictions.</span>
                  <a href="https://eulr.fun/token/0x422fe165b2da990d18c6dca944b11dcd61519671" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-secondary)', textDecoration: 'underline', fontWeight: 600 }}>
                    To buy or sell real GRUSH, trade on Eulr.fun →
                  </a>
                </div>
              </form>
            </div>

            {/* Right Side: Prediction Jackpot Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Active Match Info */}
              <div className="card-bezel">
                {/* Tabs Header */}
                <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px', paddingBottom: '4px' }}>
                  <button
                    onClick={() => setActiveRightTab('match')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: activeRightTab === 'match' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.5)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      padding: '8px 4px',
                      cursor: 'pointer',
                      borderBottom: activeRightTab === 'match' ? '2px solid var(--color-primary)' : '2px solid transparent',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    Match Pool
                  </button>
                  <button
                    onClick={() => setActiveRightTab('scores')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: activeRightTab === 'scores' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.5)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      padding: '8px 4px',
                      cursor: 'pointer',
                      borderBottom: activeRightTab === 'scores' ? '2px solid var(--color-primary)' : '2px solid transparent',
                      transition: 'var(--transition-smooth)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Live Scores
                    <span className="live-dot"></span>
                  </button>
                  <button
                    onClick={() => setActiveRightTab('history')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: activeRightTab === 'history' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.5)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      padding: '8px 4px',
                      cursor: 'pointer',
                      borderBottom: activeRightTab === 'history' ? '2px solid var(--color-primary)' : '2px solid transparent',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    My History
                  </button>
                </div>

                {activeRightTab === 'match' && (() => {
                  const totalVotes = teamAVotes + teamBVotes + teamDrawVotes;
                  const percentageA = totalVotes > 0 ? ((teamAVotes / totalVotes) * 100).toFixed(0) : '33';
                  const percentageDraw = totalVotes > 0 ? ((teamDrawVotes / totalVotes) * 100).toFixed(0) : '33';
                  const percentageB = totalVotes > 0 ? ((teamBVotes / totalVotes) * 100).toFixed(0) : '34';

                  const widthA = totalVotes > 0 ? (teamAVotes / totalVotes) * 100 : 33.3;
                  const widthDraw = totalVotes > 0 ? (teamDrawVotes / totalVotes) * 100 : 33.3;
                  const widthB = totalVotes > 0 ? (teamBVotes / totalVotes) * 100 : 33.4;

                  return (
                    <>
                      <div className="jackpot-display">
                        <div className="swap-label">TOTAL ACCUMULATED JACKPOT</div>
                        <div className="jackpot-val">{jackpot.toFixed(4)} OKB</div>
                        <div className="jackpot-val-grush" style={{ fontSize: '1.2rem', color: '#ff00aa', marginTop: '4px', fontWeight: 'bold' }}>
                          + {grushJackpot.toLocaleString(undefined, { maximumFractionDigits: 2 })} GRUSH
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                          ≈ ${(jackpot * 60 + grushJackpot * 0.05).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                        </div>
                      </div>

                      <div className="predict-bar-container">
                        <div className="swap-label">Prediction Volume Split</div>

                        <div className={`team-row ${prediction === 1 ? 'selected' : ''}`} onClick={() => handlePredictionChange(1)}>
                          <div className="team-meta">
                            <img src={getFlagUrl(getTeamFifaCode(activeMatch.teamA))} alt={activeMatch.teamA} className="team-flag" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }} />
                            <span className="team-name">{activeMatch.teamA}</span>
                          </div>
                          <span className="team-odds">{teamAVotes.toFixed(1)} OKB ({percentageA}%)</span>
                        </div>

                        <div className={`team-row ${prediction === 3 ? 'selected' : ''}`} onClick={() => handlePredictionChange(3)}>
                          <div className="team-meta">
                            <span style={{ fontSize: '1.1rem', marginRight: '8px' }}>🤝</span>
                            <span className="team-name">Draw</span>
                          </div>
                          <span className="team-odds">{teamDrawVotes.toFixed(1)} OKB ({percentageDraw}%)</span>
                        </div>

                        <div className={`team-row ${prediction === 2 ? 'selected' : ''}`} onClick={() => handlePredictionChange(2)}>
                          <div className="team-meta">
                            <img src={getFlagUrl(getTeamFifaCode(activeMatch.teamB))} alt={activeMatch.teamB} className="team-flag" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }} />
                            <span className="team-name">{activeMatch.teamB}</span>
                          </div>
                          <span className="team-odds">{teamBVotes.toFixed(1)} OKB ({percentageB}%)</span>
                        </div>

                        <div className="odds-progress-wrap" style={{ display: 'flex', height: '8px', borderRadius: '4px' }}>
                          <div
                            style={{
                              width: `${widthA}%`,
                              height: '100%',
                              background: 'var(--color-primary)',
                              transition: 'width 0.5s ease'
                            }}
                          />
                          <div
                            style={{
                              width: `${widthDraw}%`,
                              height: '100%',
                              background: 'rgba(255, 255, 255, 0.35)',
                              transition: 'width 0.5s ease'
                            }}
                          />
                          <div
                            style={{
                              width: `${widthB}%`,
                              height: '100%',
                              background: '#ff007a',
                              transition: 'width 0.5s ease'
                            }}
                          />
                        </div>
                      </div>
                      {/* Console Logs */}
                      <div style={{ marginTop: '24px' }}>
                        <div className="swap-label">Transaction Console Logs</div>
                        <div className="console-logs">
                          {logs.map((log, index) => (
                            <div key={index} className={`log-entry ${log.includes('GOAL') ? 'goal' : ''}`}>
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}

                {activeRightTab === 'scores' && (() => {
                  const todayStart = new Date();
                  todayStart.setHours(0,0,0,0);
                  const todayStartMs = todayStart.getTime();

                  const tomorrowEnd = new Date();
                  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
                  tomorrowEnd.setHours(23,59,59,999);
                  const tomorrowEndMs = tomorrowEnd.getTime();

                  const live = liveMatches.filter(m => m.isLive && m.minute !== 'FT').sort((a, b) => a.startTime - b.startTime);
                  const upcoming = liveMatches.filter(m => {
                    if (m.isLive || m.minute === 'FT') return false;
                    return m.startTime >= todayStartMs && m.startTime <= tomorrowEndMs;
                  }).sort((a, b) => a.startTime - b.startTime);
                  const displayMatches = [...live, ...upcoming];

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {displayMatches.map((m) => {
                        const isSelected = activeMatch.id === m.id;
                        const isActiveOnChain = getNumericMatchId(m.id) === onChainActiveId && onChainActiveId > 0n;
                        return (
                          <div
                            key={m.id}
                            onClick={() => handleSelectMatchUI(m)}
                            style={{
                              background: isSelected ? 'rgba(157, 255, 0, 0.03)' : 'rgba(255,255,255,0.02)',
                              padding: '16px',
                              borderRadius: '12px',
                              border: isSelected ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              transition: 'var(--transition-smooth)'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img
                                  src={getFlagUrl(m.flagA)}
                                  alt={m.teamA}
                                  style={{
                                    width: '20px',
                                    height: '14px',
                                    objectFit: 'cover',
                                    borderRadius: '2px',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    display: 'inline-block'
                                  }}
                                />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--color-primary)' : '#fff' }}>{m.teamA}</span>
                                <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-primary)' }}>{m.scoreA}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img
                                  src={getFlagUrl(m.flagB)}
                                  alt={m.teamB}
                                  style={{
                                    width: '20px',
                                    height: '14px',
                                    objectFit: 'cover',
                                    borderRadius: '2px',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    display: 'inline-block'
                                  }}
                                />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--color-primary)' : '#fff' }}>{m.teamB}</span>
                                <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-primary)' }}>{m.scoreB}</span>
                              </div>
                            </div>

                            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '16px', marginLeft: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '80px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: (m.isLive && m.minute !== 'FT') ? 'var(--color-primary)' : 'rgba(255,255,255,0.4)' }}>
                                {m.minute}
                              </span>
                              {m.isLive && m.minute !== 'FT' ? (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    color: '#ff3344',
                                    textTransform: 'uppercase',
                                    fontWeight: 700,
                                    marginTop: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <span style={{ width: '4px', height: '4px', backgroundColor: '#ff3344', borderRadius: '50%', display: 'inline-block', animation: 'live-pulse 1.2s infinite' }}></span>
                                  LIVE
                                </span>
                              ) : m.minute === 'FT' ? (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    color: 'rgba(255, 255, 255, 0.4)',
                                    marginTop: '4px',
                                    textAlign: 'center',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {m.scoreA > m.scoreB
                                    ? `${m.teamA} Won`
                                    : m.scoreB > m.scoreA
                                      ? `${m.teamB} Won`
                                      : 'Draw'}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    color: '#00e5ff',
                                    marginTop: '4px',
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                  }}
                                >
                                  Upcoming
                                </span>
                              )}
                              {isActiveOnChain ? (
                                <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 700, marginTop: '6px', background: 'rgba(157, 255, 0, 0.12)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                  ON-CHAIN
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleActivateMatchOnChain(m);
                                  }}
                                  style={{
                                    fontSize: '0.65rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#fff',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginTop: '6px',
                                    transition: 'all 0.2s',
                                    fontWeight: 600
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'var(--color-primary)';
                                    e.target.style.color = '#000';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.target.style.color = '#fff';
                                  }}
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <button
                        onClick={() => setCurrentView('match-center')}
                        style={{
                          marginTop: '8px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          color: 'var(--color-primary)',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'var(--transition-smooth)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(157, 255, 0, 0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                      >
                        View All Matches in Match Center 🏆 →
                      </button>
                    </div>
                  );
                })()}{activeRightTab === 'history' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                      Your Simulation Logs
                    </h4>
                    {history.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '24px 0' }}>
                        No predictions recorded yet. Run a shootout strike to start!
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                        {history.map((h) => (
                          <div
                            key={h.id}
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              fontSize: '0.78rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, color: '#fff' }}>{h.match}</span>
                              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{h.timestamp}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>
                                Predicted: <strong style={{ color: 'var(--color-primary)' }}>{h.prediction}</strong>
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: h.result.includes('GOAL') ? 'var(--color-secondary)' : 'var(--color-danger)' }}>
                                {h.result}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                              <span>Size: {h.amount}</span>
                              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Jackpot Share Allocation</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Leaderboards */}
          <section id="leaderboard" className="card-bezel" style={{ marginBottom: '64px' }}>
            <h3 className="panel-title">
              <Flame size={20} style={{ color: 'var(--color-primary)' }} />
              Tournament Goal Leaderboard
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
              Top creators and swappers registered on OKX X Layer during the tournament.
            </p>

            {!scanState.done && (
              <div style={{
                fontSize: '0.82rem',
                color: '#9dff00',
                background: 'rgba(157, 255, 0, 0.05)',
                border: '1px solid rgba(157, 255, 0, 0.15)',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                <span style={{ fontSize: '1rem' }}>⚡</span>
                <span style={{ fontWeight: '500' }}>
                  Syncing on-chain predictions: {Math.min(99, Math.floor(((scanState.current - 62494373) / Math.max(1, scanState.total - 62494373)) * 100))}% complete (indexing blocks {scanState.current.toLocaleString()} of {scanState.total.toLocaleString()})
                </span>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                    <th style={{ padding: '12px' }}>Rank</th>
                    <th style={{ padding: '12px' }}>Swapper Address</th>
                    <th style={{ padding: '12px' }}>Goals Scored</th>
                    <th style={{ padding: '12px' }}>Total Trade Volume</th>
                    <th style={{ padding: '12px' }}>Winnings Claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.length > 0 ? (
                    leaderboardData.map((row, idx) => {
                      const isCurrentUser = walletConnected && userAddress && row.address.toLowerCase() === userAddress.toLowerCase();
                      return (
                        <tr
                          key={row.address}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: isCurrentUser ? 'rgba(157, 255, 0, 0.05)' : 'transparent'
                          }}
                        >
                          <td style={{
                            padding: '12px',
                            fontWeight: 'bold',
                            color: isCurrentUser
                              ? 'var(--color-primary)'
                              : idx === 0
                                ? 'var(--color-primary)'
                                : idx === 1
                                  ? '#c0c0c0'
                                  : idx === 2
                                    ? '#cd7f32'
                                    : 'rgba(255,255,255,0.6)'
                          }}>
                            {isCurrentUser ? 'MY' : `#${idx + 1}`}
                          </td>
                          <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                            {row.address.slice(0, 8)}...{row.address.slice(-6)}
                          </td>
                          <td style={{ padding: '12px' }}>{row.goals} Goals</td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: '500' }}>{row.volume.toFixed(4)} OKB</div>
                            {row.grushVolume > 0 && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '2px', fontWeight: 'bold' }}>
                                ⚽ {row.grushVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} GRUSH
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px' }}>
                             <div style={{ fontWeight: '500', color: 'var(--color-primary)' }}>{row.claimed.toFixed(4)} OKB</div>
                             {row.grushClaimed > 0 && (
                               <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', marginTop: '2px', fontWeight: 'bold' }}>
                                 ⚽ {row.grushClaimed.toLocaleString(undefined, { maximumFractionDigits: 0 })} GRUSH
                               </div>
                             )}
                           </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                        No active swappers recorded yet. Swap & predict to become the first on the board!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* About & Technical Details Section */}
          <section id="about" className="card-bezel" style={{ marginBottom: '64px', marginTop: '32px' }}>
            <h3 className="panel-title">
              <Award size={20} style={{ color: 'var(--color-primary)' }} />
              About GoalRush
            </h3>

            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', marginBottom: '24px' }}>
              GoalRush is a decentralized sports prediction protocol built natively on OKX X Layer. It leverages the cutting-edge capabilities of <strong>Uniswap V4 Hooks</strong> to seamlessly combine yield, sports prediction jackpots, and gamified swap fee rebates directly within decentralized trading pools.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚽ Prediction Jackpot
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5', marginBottom: '8px' }}>
                  Pick a result and fund it with OKB or GRUSH through the prediction router. Only transferred assets count toward the claimable jackpot; observed swap volume is informational.
                </p>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
                  <strong>Claim Rules:</strong> Once the match is resolved on-chain, winners pull their winnings proportionally: <code>(Your Swap Volume / Total Winning Team Volume) * Total Jackpot Pool</code>.
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🏆 Boosts & Multipliers
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5', marginBottom: '8px' }}>
                  Top users with higher <strong>in-game goals scored</strong>, more <strong>GRUSH token holdings</strong>, and larger <strong>prediction volume</strong> receive ecosystem multipliers.
                </p>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
                  <strong>Reward weight:</strong> Your leaderboard status directly boosts your reward share weights in the pools and future drops, rewarding the most active members.
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📡 Live Match Integration
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5', marginBottom: '8px' }}>
                  Choose from real-world matches in the Live Scores feed. Anyone can select a fixture, and the contract owner can instantiate it directly onto the contract with a single click.
                </p>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
                  <strong>Real-Time Updates:</strong> Live matches load automatically. Simply click any match in the feed to set it as the target prediction match in the swap widget.
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚡ Goal Rush Rebate
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
                  The hook records a pseudo-random goal event at a configurable rate. The current contract emits an event but does not transfer an automatic fee rebate; the penalty animation is presentation only.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔗 X Layer Integration
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
                  Deployed on OKX X Layer Mainnet, GoalRush utilizes high-speed block confirmation times and ultra-low gas fees. Swappers experience instant transaction feedback on penalty shootouts and minimal fee overhead.
                </p>
              </div>
            </div>

            {/* Developer Sandbox Panel Toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(157, 255, 0, 0.03)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(157, 255, 0, 0.15)' }}>
              <h4 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '8px', color: '#fff' }}>Developer Sandbox & Hackathon Panel</h4>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: '16px', maxWidth: '600px' }}>
                Are you a hackathon judge or smart contract developer? Inspect the underlying Uniswap V4 Hook Solidity code, CREATE2 deployment scripts, RPC details, and Eulr.fun graduation rules.
              </p>
              <button
                className="btn-primary"
                onClick={() => setShowDevPortal(!showDevPortal)}
                style={{
                  padding: '10px 24px',
                  fontSize: '0.9rem',
                  gap: '8px',
                  backgroundColor: showDevPortal ? 'transparent' : 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  color: showDevPortal ? 'var(--color-primary)' : '#000'
                }}
              >
                <Code size={16} />
                <span>{showDevPortal ? 'Hide Developer Sandbox' : 'Open Developer Sandbox'}</span>
              </button>
            </div>
          </section>
        </>
      )}

      {currentView === 'match-center' && (() => {
        if (!liveMatches || liveMatches.length === 0) {
          return (
            <div style={{ marginTop: '32px', textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'rgba(255,255,255,0.7)' }}>No Matches Available</div>
              <div>Connecting to live matches database...</div>
            </div>
          );
        }
        const selectedMatch = liveMatches.find(m => m.id === selectedMatchCenterId) || liveMatches[0];
        const filteredMatches = liveMatches.filter(m => {
          if (matchFilter === 'live') return m.isLive && m.minute !== 'FT';
          if (matchFilter === 'completed') return m.minute === 'FT';
          if (matchFilter === 'upcoming') return !m.isLive && m.minute !== 'FT';
          return true;
        });

        const liveGroup = filteredMatches.filter(m => m.isLive && m.minute !== 'FT');
        const todayUpcomingGroup = filteredMatches.filter(m => !m.isLive && m.minute !== 'FT' && m.date === TODAY_LABEL);
        const tomorrowGroup = filteredMatches.filter(m => m.date === TOMORROW_LABEL && !m.isLive && m.minute !== 'FT');
        const completedGroup = filteredMatches.filter(m => m.minute === 'FT');
        const upcomingFutureGroup = filteredMatches.filter(m => !m.isLive && m.minute !== 'FT' && m.date !== TODAY_LABEL && m.date !== TOMORROW_LABEL);

        return (
          <div style={{ marginTop: '32px' }}>
            <section className="match-center-header" style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '2.5rem' }}>🏆</span>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff 0%, var(--color-primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Match Center Hub</h2>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginTop: '4px' }}>Real-time match scoring, tactical formations, and decentralized prediction jackpot pools.</p>
                </div>
              </div>
            </section>

            <div className="match-center-container">
              <div className="match-center-left">
                <div className="match-filter-tabs">
                  <button onClick={() => setMatchFilter('all')} className={`match-filter-btn ${matchFilter === 'all' ? 'active' : ''}`}>All</button>
                  <button onClick={() => setMatchFilter('live')} className={`match-filter-btn ${matchFilter === 'live' ? 'active' : ''} live-tab`}>Live 🔴</button>
                  <button onClick={() => setMatchFilter('upcoming')} className={`match-filter-btn ${matchFilter === 'upcoming' ? 'active' : ''}`}>Upcoming</button>
                  <button onClick={() => setMatchFilter('completed')} className={`match-filter-btn ${matchFilter === 'completed' ? 'active' : ''}`}>Completed</button>
                </div>

                {liveGroup.length > 0 && (
                  <>
                    <div className="match-group-header">Live Matches 🔴</div>
                    {liveGroup.map(m => renderMatchCard(m))}
                  </>
                )}

                {todayUpcomingGroup.length > 0 && (
                  <>
                    <div className="match-group-header">Today - Upcoming ({TODAY_LABEL})</div>
                    {todayUpcomingGroup.map(m => renderMatchCard(m))}
                  </>
                )}

                {tomorrowGroup.length > 0 && (
                  <>
                    <div className="match-group-header">Tomorrow ({TOMORROW_LABEL})</div>
                    {tomorrowGroup.map(m => renderMatchCard(m))}
                  </>
                )}

                {upcomingFutureGroup.length > 0 && (
                  <>
                    <div className="match-group-header">Upcoming Fixtures</div>
                    {upcomingFutureGroup.map(m => renderMatchCard(m))}
                  </>
                )}

                {completedGroup.length > 0 && (
                  <>
                    <div className="match-group-header">Completed Matches (FT)</div>
                    {completedGroup.map(m => renderMatchCard(m))}
                  </>
                )}

                {filteredMatches.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    No matches found for the selected filter.
                  </div>
                )}
              </div>

              <div className="match-center-right">
                {renderMatchHubDetails(selectedMatch)}
              </div>
            </div>
          </div>
        );
      })()}

      {showDevPortal && (
        <>
          {/* Smart Contracts & Explorer */}
          <section id="contracts" className="code-section">
            <h3 className="panel-title">
              <Code size={20} style={{ color: 'var(--color-primary)' }} /> Smart Contract Repository
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
              Inspect the Solidity hook logic and deploy pipelines prepared for OKX X Layer.
            </p>

            <div className="tabs-header">
              <button
                className={`tab-button ${activeTab === 'hook' ? 'active' : ''}`}
                onClick={() => setActiveTab('hook')}
              >
                WorldCupGoalRushHook.sol
              </button>
              <button
                className={`tab-button ${activeTab === 'mock' ? 'active' : ''}`}
                onClick={() => setActiveTab('mock')}
              >
                MockPoolManager.sol
              </button>
              <button
                className={`tab-button ${activeTab === 'deploy' ? 'active' : ''}`}
                onClick={() => setActiveTab('deploy')}
              >
                deploy.js
              </button>
              <button
                className={`tab-button ${activeTab === 'readme' ? 'active' : ''}`}
                onClick={() => setActiveTab('readme')}
              >
                README.md
              </button>
            </div>

            <div className="code-viewer-container">
              <div className="code-header">
                <span className="code-lang">
                  {activeTab === 'hook' || activeTab === 'mock' ? 'SOLIDITY' : activeTab === 'deploy' ? 'JAVASCRIPT' : 'MARKDOWN'}
                </span>
                <button
                  className="btn-copy"
                  onClick={() => {
                    const textMap = {
                      hook: currentHookSolidityCode,
                      mock: mockManagerCode,
                      deploy: deployScriptCode,
                      readme: readmeMarkdown
                    }
                    copyCode(textMap[activeTab])
                  }}
                >
                  <Copy size={12} /> Copy Code
                </button>
              </div>

              <pre className="code-pre">
                <code>
                  {activeTab === 'hook' && currentHookSolidityCode}
                  {activeTab === 'mock' && mockManagerCode}
                  {activeTab === 'deploy' && deployScriptCode}
                  {activeTab === 'readme' && readmeMarkdown}
                </code>
              </pre>
            </div>
          </section>

          {/* Deployment Guide */}
          <section id="docs" className="card-bezel" style={{ marginBottom: '64px' }}>
            <h3 className="panel-title">
              <Cpu size={20} style={{ color: 'var(--color-primary)' }} /> Deploying on X Layer Mainnet
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ background: 'var(--color-primary-glow)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--color-primary)', fontWeight: 'bold', flexShrink: 0, justifyContent: 'center' }}>1</div>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Compile with Hardhat</h4>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Use the Solidity compiler version 0.8.24 or later to ensure compatibility with EVM push/pop logic.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ background: 'var(--color-primary-glow)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--color-primary)', fontWeight: 'bold', flexShrink: 0, justifyContent: 'center' }}>2</div>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Address Mining</h4>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Uniswap V4 hooks require the deployed address to match flag prefixes. Use address mining tools to find the proper salt for CREATE2.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ background: 'var(--color-primary-glow)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--color-primary)', fontWeight: 'bold', flexShrink: 0, justifyContent: 'center' }}>3</div>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Verify on X Layer Explorer</h4>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Submit contracts to OKX Link/Explorer for public verification using ABI-encoded initialization parameters.</p>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--color-primary)' }} />
                  X Layer RPC Information
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Network Name</span>
                    <span>X Layer Mainnet</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>RPC URL</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>https://rpc.xlayer.tech</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Chain ID</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>196</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Currency Symbol</span>
                    <span>OKB</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Block Explorer</span>
                    <span style={{ color: 'var(--color-primary)' }}>https://www.okx.com/explorer/xlayer</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(157, 255, 0, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(157, 255, 0, 0.15)' }}>
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                  <Flame size={16} />
                  Token Deployment Choices
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem' }}>
                  <div>
                    <strong style={{ color: 'var(--color-secondary)' }}>Option 1: Deploy Token Ourselves (Independent Launch)</strong>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '4px' }}>
                      Compile and deploy the <code>GoalRushToken.sol</code> contract directly to X Layer Mainnet using Hardhat:
                      <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '4px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>npx hardhat run scripts/deploy-token.cjs --network xlayer</code>
                    </p>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                    <strong style={{ color: 'var(--color-primary)' }}>Option 2: Launch via Eulr.fun (Bonding Curve)</strong>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '4px' }}>
                      Create token + bonding curve on Eulr.fun, hit the curve limit to automatically deploy the Uniswap V4 Pool with this hook, and qualify for the $200k prize ranking.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {showWhitepaper && (
        <div className="whitepaper-modal-overlay" onClick={() => setShowWhitepaper(false)}>
          <div className="whitepaper-modal-container" onClick={(e) => e.stopPropagation()}>
            <button className="whitepaper-close-btn" onClick={() => setShowWhitepaper(false)}>
              <X size={18} />
            </button>
            <img src="/whitepaper-banner.png" alt="GoalRush Whitepaper" className="whitepaper-header-banner" />

            <div className="whitepaper-content">
              <div className="whitepaper-section" style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '2.2rem', marginBottom: '8px' }}>GOALRUSH WHITEPAPER</h1>
                <p style={{ color: 'var(--color-primary)', fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>
                  Sports Prediction Engine Powered by Uniswap V4
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '16px', fontSize: '0.8rem', opacity: 0.6 }}>
                  <span>Published: June 2026</span>
                  <span>•</span>
                  <span>Version: 1.0.2</span>
                  <span>•</span>
                  <span>Chain: OKX X Layer Mainnet</span>
                </div>
              </div>

              <div className="whitepaper-section">
                <h2>1. Executive Summary</h2>
                <p>
                  GoalRush (GRUSH) is a decentralized sports prediction protocol designed to align liquidity incentives, Web3 gaming, and active market trading. Deployed on the <strong>OKX X Layer Mainnet</strong>, GoalRush utilizes custom <strong>Uniswap V4 Hooks</strong> to route prediction ticket purchases directly through AMM swap events.
                </p>
                <p style={{ marginTop: '12px' }}>
                  By turning trade volumes into prediction tickets and goalie shootout challenges, GoalRush creates a self-sustaining gamified ecosystem. Holders of the <strong>GRUSH</strong> utility token receive structural gameplay advantages (such as penalty strike success boosts) and unique visual profiles within the application, encouraging organic demand and token retention.
                </p>
              </div>

              <div className="whitepaper-section">
                <h2>2. Architecture & Uniswap V4 Hook Design</h2>
                <p>
                  GoalRush integrates directly with Uniswap V4's lifecycle callback hooks to trigger off-chain events and on-chain prediction entries. The core of this system is the <code>WorldCupGoalRushHook</code> contract.
                </p>

                <h3>2.1 The beforeSwap Callback</h3>
                <p>
                  When a user initiates a prediction transaction via the dashboard:
                </p>
                <ul>
                  <li>The swap parameters and prediction selection (Team A vs Team B) are compiled and sent to the hook.</li>
                  <li>The <code>beforeSwap</code> callback extracts the prediction payload (e.g. <code>hookData</code>).</li>
                  <li>The smart contract automatically registers the swapper’s choice, increments their predicted team's volume, and allocates 100% of the native OKB sent directly into the <strong>Match Jackpot Pool</strong>.</li>
                </ul>

                <div className="whitepaper-diagram-box">
                  {"User Swap Initiated"} <br />
                  {"  │"}<br />
                  {"  ▼"}<br />
                  {"Uniswap V4 PoolManager"}<br />
                  {"  │  (calls callback)"}<br />
                  {"  ▼"}<br />
                  {"beforeSwap() on Hook Contract"}<br />
                  {"  │"}<br />
                  {"  ├──► Decodes prediction (Team A/B)"}<br />
                  {"  ├──► Increments match prediction volume"}<br />
                  {"  └──► Locks OKB value in Jackpot Pool"}<br />
                </div>

                <h3>2.2 The afterSwap Callback & Shootout Rebates</h3>
                <p>
                  Following the completion of the swap, the <code>afterSwap</code> callback is executed. This initiates a goalkeeper save/shootout simulation. If the user successfully scores a goal against the automated goalkeeper, they are rewarded with a <strong>Fee Rebate</strong>:
                </p>
                <ul>
                  <li><strong>Standard Players:</strong> Have a base 50% probability of scoring a goal.</li>
                  <li><strong>GRUSH Token Holders:</strong> Holding GRUSH tokens activates the **VIP Shooter Perk**, increasing the success rate to <strong>75%</strong> and applying a custom green glow to their UI.</li>
                  <li>On a successful score, a rebate payout (simulated from the pool's accumulated hook fees) is emitted back to the swapper.</li>
                </ul>
              </div>

              <div className="whitepaper-section">
                <h2>3. Game Mechanics & Jackpot Resolution</h2>
                <div className="whitepaper-grid-2">
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ marginTop: 0 }}>Accumulating the Jackpot</h3>
                    <p style={{ fontSize: '0.85rem' }}>
                      Every shootout prediction ticket locks native OKB directly inside the Hook contract. Unlike standard prediction markets with high fee cuts, GoalRush allocates 100% of the user-submitted amount directly into the Match Jackpot Pool, creating massive pools for key matches.
                    </p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ marginTop: 0 }}>Claiming the Pool</h3>
                    <p style={{ fontSize: '0.85rem' }}>
                      Once the real-world match is resolved, the oracle updates the winner on-chain. Users who predicted the winning team can call <code>claimJackpot</code>. The contract automatically calculates their proportional share:
                      <br />
                      <code style={{ display: 'block', margin: '8px 0', padding: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        Payout = (UserBet * TotalJackpot) / WinnerTotalVolume
                      </code>
                    </p>
                  </div>
                </div>
              </div>

              <div className="whitepaper-section">
                <h2>4. The GRUSH Utility Token</h2>
                <p>
                  To maximize compliance with hackathon regulations and foster permissionless market listing, the <strong>GRUSH</strong> token was launched on the <strong>Eulr.fun</strong> bonding curve platform.
                </p>
                <ul>
                  <li><strong>Contract Address:</strong> <code>0x422fe165b2da990d18c6dca944b11dcd61519671</code></li>
                  <li><strong>Real-Time Balance Checks:</strong> The dApp performs on-chain queries to verify if the connected wallet holds GRUSH.</li>
                  <li><strong>VIP Highlights:</strong> Holding any amount of GRUSH applies neon-green aesthetic text shadows to the player's dashboard profile and registers them as a premium member in the prediction logs.</li>
                </ul>
              </div>

              <div className="whitepaper-section" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
                <h2>5. Security & Verification</h2>
                <p>
                  The GoalRush codebase has undergone a complete security check to ensure transparency and prevent loss of user funds:
                </p>
                <ol style={{ paddingLeft: '20px' }}>
                  <li><strong>Strict OKX Wallet Isolation:</strong> Connection is locked to the official OKX wallet to prevent phishing or multi-wallet collisions.</li>
                  <li><strong>Non-Custodial Design:</strong> The jackpot pools are managed entirely by immutable contract logic, and admin withdrawals are restricted to verify jackpot payout solvency.</li>
                  <li><strong>Eulr-fun Bonding Safety:</strong> Real token swaps happen permissionlessly on Euler, shielding the dApp simulator from token vault vulnerabilities.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p>© 2026 GoalRush. Powered by Uniswap V4 & OKX X Layer.</p>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}>Terms of Service</button>
            <span>•</span>
            <button onClick={() => setShowPrivacy(true)} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}>Privacy Policy</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <a
            href="https://x.com/goalrushdotfun"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgba(255,255,255,0.6)', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            <Twitter size={16} /> Twitter / X
          </a>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <a
            href="https://t.me/+qwzA9MrSA3I2OTk9"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgba(255,255,255,0.6)', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            <Send size={16} /> Telegram
          </a>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <a
            href="https://gitlab.com/tanizcoldz/goal-rush"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgba(255,255,255,0.6)', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fc6d26'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263C4.783.84 4.185.84 4.05 1.26L1.386 9.449.044 13.587c-.121.375.014.789.331 1.023L12 23.054l11.625-8.443c.318-.235.453-.647.33-1.024z"/>
            </svg>
            GitLab
          </a>
        </div>
      </footer>

      {showTerms && (
        <div className="whitepaper-modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="whitepaper-modal-container" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <button className="whitepaper-close-btn" onClick={() => setShowTerms(false)}>
              <X size={18} />
            </button>
            <div className="whitepaper-content" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '16px' }}>Terms of Service</h2>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.85 }}>
                <p><strong>Last Updated: June 13, 2026</strong></p>
                <p>Please read these Terms of Service carefully before interacting with the GoalRush platform. By connecting your wallet and participating, you agree to these Terms.</p>

                <p><strong>1. Educational & Simulation Use Only</strong></p>
                <p>GoalRush is a proof-of-concept dApp built for the Build X Hackathon. All on-chain simulations, predictions, and games are provided for educational and gaming purposes. There is no guarantee of profits or rewards.</p>

                <p><strong>2. Assumption of Risk</strong></p>
                <p>All transactions are executed directly by the user via their Web3 wallet (OKX Wallet) on the public X Layer blockchain. You accept full responsibility for any native OKB, gas costs, or token interactions. We have zero control over on-chain executions.</p>

                <p><strong>3. Solvency & Disclaimer</strong></p>
                <p>GoalRush is provided "as is" and "as available" without any warranties of any kind. We are not liable for any losses, contract bugs, network downtime, or wallet service provider issues.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div className="whitepaper-modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="whitepaper-modal-container" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <button className="whitepaper-close-btn" onClick={() => setShowPrivacy(false)}>
              <X size={18} />
            </button>
            <div className="whitepaper-content" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '16px' }}>Privacy Policy</h2>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.85 }}>
                <p><strong>Last Updated: June 13, 2026</strong></p>
                <p>GoalRush is committed to protecting user privacy. Because our platform is a decentralized application, we operate differently than standard websites.</p>

                <p><strong>1. No Collection of Personal Data</strong></p>
                <p>We do not collect, store, or process any personal identification information (PII) such as your name, email address, IP address, or physical address. There is no sign-up form or database account registration.</p>

                <p><strong>2. Blockchain Publicity</strong></p>
                <p>Your connected wallet address, token balances, and prediction transaction details are broadcasted to the public X Layer blockchain network. This data is open-source, permanent, and accessible by anyone.</p>

                <p><strong>3. Third-Party Services</strong></p>
                <p>When you interact with the OKX Wallet extension or the Eulr.fun bonding curve, you are subject to their respective terms and privacy policies. We do not control third-party Web3 infrastructure.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
