/// Smart Fasal — Parametric Crop Insurance
/// Deployed on Starknet Sepolia
///
/// Farmers register policies with soil/climate thresholds.
/// When IoT sensor data proves drought or heat stress,
/// the oracle (our backend) submits a claim and the event
/// is permanently recorded on-chain with a data hash.

#[starknet::interface]
pub trait IParametricInsurance<TContractState> {
    fn register_policy(
        ref self: TContractState,
        farmer_id: felt252,
        drought_moisture_threshold: u64,
        heat_temp_threshold: u64,
    );
    fn submit_claim(
        ref self: TContractState,
        farmer_id: felt252,
        trigger: felt252,
        soil_data_hash: felt252,
        moisture: u64,
        temperature: u64,
    );
    fn get_policy(self: @TContractState, farmer_id: felt252) -> Policy;
    fn get_claim(self: @TContractState, claim_id: u64) -> Claim;
    fn get_claim_count(self: @TContractState) -> u64;
    fn get_oracle(self: @TContractState) -> starknet::ContractAddress;
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Policy {
    pub farmer_id: felt252,
    pub active: bool,
    pub drought_moisture_threshold: u64,
    pub heat_temp_threshold: u64,
    pub registered_at: u64,
    pub claim_count: u64,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Claim {
    pub claim_id: u64,
    pub farmer_id: felt252,
    pub trigger: felt252,
    pub soil_data_hash: felt252,
    pub moisture: u64,
    pub temperature: u64,
    pub timestamp: u64,
    pub verified: bool,
}

#[starknet::contract]
mod ParametricInsurance {
    use super::{Policy, Claim};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        oracle: ContractAddress,
        owner: ContractAddress,
        policies: Map<felt252, Policy>,
        claims: Map<u64, Claim>,
        claim_count: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        PolicyRegistered: PolicyRegistered,
        InsuranceClaimed: InsuranceClaimed,
    }

    #[derive(Drop, starknet::Event)]
    struct PolicyRegistered {
        #[key]
        farmer_id: felt252,
        drought_moisture_threshold: u64,
        heat_temp_threshold: u64,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct InsuranceClaimed {
        #[key]
        claim_id: u64,
        #[key]
        farmer_id: felt252,
        trigger: felt252,
        soil_data_hash: felt252,
        moisture: u64,
        temperature: u64,
        timestamp: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, oracle: ContractAddress) {
        let deployer = get_caller_address();
        self.owner.write(deployer);
        self.oracle.write(oracle);
        self.claim_count.write(0);
    }

    #[abi(embed_v0)]
    impl ParametricInsuranceImpl of super::IParametricInsurance<ContractState> {
        fn register_policy(
            ref self: ContractState,
            farmer_id: felt252,
            drought_moisture_threshold: u64,
            heat_temp_threshold: u64,
        ) {
            let timestamp = get_block_timestamp();
            let policy = Policy {
                farmer_id,
                active: true,
                drought_moisture_threshold,
                heat_temp_threshold,
                registered_at: timestamp,
                claim_count: 0,
            };
            self.policies.write(farmer_id, policy);
            self.emit(PolicyRegistered {
                farmer_id,
                drought_moisture_threshold,
                heat_temp_threshold,
                timestamp,
            });
        }

        fn submit_claim(
            ref self: ContractState,
            farmer_id: felt252,
            trigger: felt252,
            soil_data_hash: felt252,
            moisture: u64,
            temperature: u64,
        ) {
            let caller = get_caller_address();
            assert!(caller == self.oracle.read(), "Only oracle can submit claims");

            let mut policy = self.policies.read(farmer_id);
            assert!(policy.active, "No active policy for this farmer");

            // Verify trigger conditions match the claim
            let is_drought = trigger == 'drought' && moisture < policy.drought_moisture_threshold;
            let is_heat = trigger == 'heat_stress' && temperature > policy.heat_temp_threshold;
            assert!(is_drought || is_heat, "Sensor data does not meet trigger conditions");

            let claim_id = self.claim_count.read();
            let timestamp = get_block_timestamp();

            let claim = Claim {
                claim_id,
                farmer_id,
                trigger,
                soil_data_hash,
                moisture,
                temperature,
                timestamp,
                verified: true,
            };

            self.claims.write(claim_id, claim);
            policy.claim_count += 1;
            self.policies.write(farmer_id, policy);
            self.claim_count.write(claim_id + 1);

            self.emit(InsuranceClaimed {
                claim_id,
                farmer_id,
                trigger,
                soil_data_hash,
                moisture,
                temperature,
                timestamp,
            });
        }

        fn get_policy(self: @ContractState, farmer_id: felt252) -> Policy {
            self.policies.read(farmer_id)
        }

        fn get_claim(self: @ContractState, claim_id: u64) -> Claim {
            self.claims.read(claim_id)
        }

        fn get_claim_count(self: @ContractState) -> u64 {
            self.claim_count.read()
        }

        fn get_oracle(self: @ContractState) -> ContractAddress {
            self.oracle.read()
        }
    }
}
