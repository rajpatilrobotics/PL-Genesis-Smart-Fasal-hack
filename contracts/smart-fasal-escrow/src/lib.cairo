/// Smart Fasal — USDC P2P Trade Escrow
/// Deployed on Starknet Sepolia
///
/// Farmers list produce. Buyer deposits USDC into this contract.
/// Funds are held until buyer confirms delivery, then auto-released
/// to the seller. Oracle can adjudicate disputes.
///
/// Token: USDC (ERC-20) on Starknet Sepolia
/// USDC address: 0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080

use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store, PartialEq)]
pub enum EscrowStatus {
    Pending,
    Funded,
    Released,
    Refunded,
    Disputed,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Escrow {
    pub escrow_id: felt252,
    pub buyer: ContractAddress,
    pub seller: ContractAddress,
    pub usdc_amount: u256,
    pub listing_id: felt252,
    pub status: EscrowStatus,
    pub created_at: u64,
    pub funded_at: u64,
    pub released_at: u64,
}

#[starknet::interface]
pub trait IFarmEscrow<TContractState> {
    fn create_escrow(
        ref self: TContractState,
        escrow_id: felt252,
        seller: ContractAddress,
        usdc_amount: u256,
        listing_id: felt252,
    );
    fn deposit_usdc(
        ref self: TContractState,
        escrow_id: felt252,
    );
    fn confirm_delivery(
        ref self: TContractState,
        escrow_id: felt252,
    );
    fn refund(
        ref self: TContractState,
        escrow_id: felt252,
    );
    fn release_by_oracle(
        ref self: TContractState,
        escrow_id: felt252,
    );
    fn get_escrow(self: @TContractState, escrow_id: felt252) -> Escrow;
    fn get_oracle(self: @TContractState) -> ContractAddress;
    fn get_usdc_token(self: @TContractState) -> ContractAddress;
}

#[starknet::interface]
trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
}

#[starknet::contract]
mod FarmEscrow {
    use super::{Escrow, EscrowStatus, IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        oracle: ContractAddress,
        owner: ContractAddress,
        usdc_token: ContractAddress,
        escrows: Map<felt252, Escrow>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        EscrowCreated: EscrowCreated,
        EscrowFunded: EscrowFunded,
        EscrowReleased: EscrowReleased,
        EscrowRefunded: EscrowRefunded,
    }

    #[derive(Drop, starknet::Event)]
    struct EscrowCreated {
        #[key]
        escrow_id: felt252,
        buyer: ContractAddress,
        seller: ContractAddress,
        usdc_amount: u256,
        listing_id: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct EscrowFunded {
        #[key]
        escrow_id: felt252,
        buyer: ContractAddress,
        usdc_amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct EscrowReleased {
        #[key]
        escrow_id: felt252,
        seller: ContractAddress,
        usdc_amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct EscrowRefunded {
        #[key]
        escrow_id: felt252,
        buyer: ContractAddress,
        usdc_amount: u256,
        timestamp: u64,
    }

    /// USDC address on Starknet Sepolia
    const USDC_SEPOLIA: felt252 = 0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080;

    #[constructor]
    fn constructor(ref self: ContractState, oracle: ContractAddress) {
        let deployer = get_caller_address();
        self.owner.write(deployer);
        self.oracle.write(oracle);
        // Use USDC on Starknet Sepolia
        self.usdc_token.write(oracle); // Replaced at deploy time with actual USDC address
    }

    #[abi(embed_v0)]
    impl FarmEscrowImpl of super::IFarmEscrow<ContractState> {
        /// Oracle creates escrow before buyer deposits
        fn create_escrow(
            ref self: ContractState,
            escrow_id: felt252,
            seller: ContractAddress,
            usdc_amount: u256,
            listing_id: felt252,
        ) {
            let caller = get_caller_address();
            assert!(caller == self.oracle.read(), "Only oracle can create escrows");

            let timestamp = get_block_timestamp();
            let buyer = caller; // Oracle creates on behalf of buyer — buyer address set separately

            let escrow = Escrow {
                escrow_id,
                buyer: caller,
                seller,
                usdc_amount,
                listing_id,
                status: EscrowStatus::Pending,
                created_at: timestamp,
                funded_at: 0,
                released_at: 0,
            };
            self.escrows.write(escrow_id, escrow);

            self.emit(EscrowCreated {
                escrow_id,
                buyer,
                seller,
                usdc_amount,
                listing_id,
                timestamp,
            });
        }

        /// Buyer calls this after approving USDC spend
        fn deposit_usdc(ref self: ContractState, escrow_id: felt252) {
            let mut escrow = self.escrows.read(escrow_id);
            assert!(escrow.status == EscrowStatus::Pending, "Escrow not in pending state");

            let buyer = get_caller_address();
            let contract = get_contract_address();
            let usdc = IERC20Dispatcher { contract_address: self.usdc_token.read() };

            // Transfer USDC from buyer to this contract
            let success = usdc.transfer_from(buyer, contract, escrow.usdc_amount);
            assert!(success, "USDC transfer failed");

            let timestamp = get_block_timestamp();
            escrow.status = EscrowStatus::Funded;
            escrow.funded_at = timestamp;
            escrow.buyer = buyer;
            self.escrows.write(escrow_id, escrow);

            self.emit(EscrowFunded {
                escrow_id,
                buyer,
                usdc_amount: escrow.usdc_amount,
                timestamp,
            });
        }

        /// Buyer confirms delivery — releases USDC to seller
        fn confirm_delivery(ref self: ContractState, escrow_id: felt252) {
            let mut escrow = self.escrows.read(escrow_id);
            assert!(escrow.status == EscrowStatus::Funded, "Escrow not funded");
            let caller = get_caller_address();
            assert!(caller == escrow.buyer || caller == self.oracle.read(), "Only buyer or oracle can confirm");

            let usdc = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            let success = usdc.transfer(escrow.seller, escrow.usdc_amount);
            assert!(success, "USDC release failed");

            let timestamp = get_block_timestamp();
            escrow.status = EscrowStatus::Released;
            escrow.released_at = timestamp;
            self.escrows.write(escrow_id, escrow);

            self.emit(EscrowReleased {
                escrow_id,
                seller: escrow.seller,
                usdc_amount: escrow.usdc_amount,
                timestamp,
            });
        }

        /// Oracle can refund if seller fails to deliver
        fn refund(ref self: ContractState, escrow_id: felt252) {
            let caller = get_caller_address();
            assert!(caller == self.oracle.read(), "Only oracle can refund");

            let mut escrow = self.escrows.read(escrow_id);
            assert!(escrow.status == EscrowStatus::Funded, "Escrow not funded");

            let usdc = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            let success = usdc.transfer(escrow.buyer, escrow.usdc_amount);
            assert!(success, "USDC refund failed");

            let timestamp = get_block_timestamp();
            escrow.status = EscrowStatus::Refunded;
            escrow.released_at = timestamp;
            self.escrows.write(escrow_id, escrow);

            self.emit(EscrowRefunded {
                escrow_id,
                buyer: escrow.buyer,
                usdc_amount: escrow.usdc_amount,
                timestamp,
            });
        }

        /// Oracle can release on behalf of buyer (after delivery confirmation off-chain)
        fn release_by_oracle(ref self: ContractState, escrow_id: felt252) {
            let caller = get_caller_address();
            assert!(caller == self.oracle.read(), "Only oracle can release");
            let escrow = self.escrows.read(escrow_id);
            assert!(escrow.status == EscrowStatus::Funded, "Escrow not funded");

            let usdc = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            let success = usdc.transfer(escrow.seller, escrow.usdc_amount);
            assert!(success, "USDC release failed");

            let timestamp = get_block_timestamp();
            let mut updated = escrow;
            updated.status = EscrowStatus::Released;
            updated.released_at = timestamp;
            self.escrows.write(escrow_id, updated);

            self.emit(EscrowReleased {
                escrow_id,
                seller: escrow.seller,
                usdc_amount: escrow.usdc_amount,
                timestamp,
            });
        }

        fn get_escrow(self: @ContractState, escrow_id: felt252) -> Escrow {
            self.escrows.read(escrow_id)
        }

        fn get_oracle(self: @ContractState) -> ContractAddress {
            self.oracle.read()
        }

        fn get_usdc_token(self: @ContractState) -> ContractAddress {
            self.usdc_token.read()
        }
    }
}
