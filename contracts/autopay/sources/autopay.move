/// Module: autopay
/// Sui Autopay Scheduler - Smart Contract for scheduling automated payments
/// Phase 7: Tracking & Monitoring with Escrow Detection and Integrity Validation
#[allow(lint(public_entry))]
module autopay::autopay {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;

    // ===== Error Constants =====
    const ENotReadyYet: u64 = 1;
    const EUnauthorized: u64 = 2;
    const EInsufficientFunds: u64 = 3;
    const EInvalidExecutionTime: u64 = 4;
    const EContractPaused: u64 = 5;
    const EInvalidStatus: u64 = 6;
    const EFeeTooLow: u64 = 7;
    const EInvalidTaskId: u64 = 8;
    const EClockDriftTooLarge: u64 = 9;

    // ===== Task Status Constants =====
    const STATUS_PENDING: u8 = 0;
    const STATUS_EXECUTED: u8 = 1;
    const STATUS_CANCELLED: u8 = 2;
    const STATUS_FAILED: u8 = 3;

    // ===== Clock Drift Constants =====
    /// Maximum allowed clock drift in milliseconds (5 seconds)
    const MAX_CLOCK_DRIFT_MS: u64 = 5000;

    // ===== Events =====
    public struct TaskCreated has copy, drop {
        task_id: ID,
        sender: address,
        recipient: address,
        execute_at: u64,
        amount: u64,
        created_at: u64
    }

    public struct TaskExecuted has copy, drop {
        task_id: ID,
        executor: address,
        timestamp: u64,
        amount: u64,
        relayer_fee_paid: u64
    }

    public struct TaskCancelled has copy, drop {
        task_id: ID,
        sender: address,
        timestamp: u64
    }

    public struct TaskFailed has copy, drop {
        task_id: ID,
        executor: address,
        timestamp: u64,
        reason: vector<u8>
    }

    public struct RegistryCreated has copy, drop {
        registry_id: ID,
        admin: address
    }

    // ===== Structs =====
    public struct ScheduledTask has key, store {
        id: UID,
        sender: address,
        recipient: address,
        balance: Balance<SUI>,
        execute_at: u64,
        relayer_fee: Balance<SUI>,
        status: u8,
        attempt_count: u64,
        last_failure_reason: vector<u8>,
        created_at: u64,
        metadata: vector<u8>
    }

    public struct TaskRegistry has key {
        id: UID,
        total_tasks_created: u64,
        total_tasks_executed: u64,
        total_tasks_cancelled: u64,
        total_tasks_failed: u64,
        total_volume: u64,
        total_fees_paid: u64,
        min_relayer_fee: u64,
        is_paused: bool,
        admin: address
    }

    public struct AdminCap has key, store {
        id: UID
    }

    // ===== Init Function =====
    fun init(ctx: &mut TxContext) {
        let admin = ctx.sender();
        
        // Create AdminCap for contract deployer
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, admin);

        // Create TaskRegistry as shared object
        let id = object::new(ctx);
        let registry_id = object::uid_to_inner(&id);
        
        let registry = TaskRegistry {
            id,
            total_tasks_created: 0,
            total_tasks_executed: 0,
            total_tasks_cancelled: 0,
            total_tasks_failed: 0,
            total_volume: 0,
            total_fees_paid: 0,
            min_relayer_fee: 1000000, // 0.001 SUI default
            is_paused: false,
            admin
        };
        
        event::emit(RegistryCreated {
            registry_id,
            admin
        });
        
        transfer::share_object(registry);
    }

    // ===== Core Functions =====
    public entry fun create_task(
        mut payment_coin: Coin<SUI>,
        recipient: address,
        execute_at: u64,
        fee_amount: u64,
        metadata: vector<u8>,
        registry: &mut TaskRegistry,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check if contract is paused
        assert!(!registry.is_paused, EContractPaused);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(execute_at > current_time, EInvalidExecutionTime);
        
        // Check minimum relayer fee
        assert!(fee_amount >= registry.min_relayer_fee, EFeeTooLow);
        
        let total_value = coin::value(&payment_coin);
        assert!(total_value > fee_amount, EInsufficientFunds);
        
        let fee_coin = coin::split(&mut payment_coin, fee_amount, ctx);
        let balance = coin::into_balance(payment_coin);
        let relayer_fee = coin::into_balance(fee_coin);
        let amount = balance::value(&balance);
        
        let id = object::new(ctx);
        let task_id = object::uid_to_inner(&id);

        let task = ScheduledTask {
            id,
            sender: ctx.sender(),
            recipient,
            balance,
            execute_at,
            relayer_fee,
            status: STATUS_PENDING,
            attempt_count: 0,
            last_failure_reason: vector::empty<u8>(),
            created_at: current_time,
            metadata
        };
        
        // Update registry statistics
        registry.total_tasks_created = registry.total_tasks_created + 1;
        registry.total_volume = registry.total_volume + amount;
        registry.total_fees_paid = registry.total_fees_paid + fee_amount;
        
        // Emit Event
        event::emit(TaskCreated {
            task_id,
            sender: ctx.sender(),
            recipient,
            execute_at,
            amount,
            created_at: current_time
        });

        transfer::share_object(task);
    }
    
    public entry fun execute_task(
        mut task: ScheduledTask,
        registry: &mut TaskRegistry,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check if contract is paused
        assert!(!registry.is_paused, EContractPaused);
        
        // Check task status
        assert!(task.status == STATUS_PENDING, EInvalidStatus);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= task.execute_at, ENotReadyYet);
        
        // Update task status and attempts
        task.attempt_count = task.attempt_count + 1;
        task.status = STATUS_EXECUTED;
        
        let ScheduledTask {
            id,
            sender: _,
            recipient,
            balance,
            execute_at: _,
            relayer_fee,
            status: _,
            attempt_count: _,
            last_failure_reason: _,
            created_at: _,
            metadata: _
        } = task;
        
        let task_id = object::uid_to_inner(&id);
        let amount = balance::value(&balance);
        let fee_amount = balance::value(&relayer_fee);

        let payment_coin = coin::from_balance(balance, ctx);
        transfer::public_transfer(payment_coin, recipient);
        
        let fee_coin = coin::from_balance(relayer_fee, ctx);
        transfer::public_transfer(fee_coin, ctx.sender());
        
        // Update registry statistics
        registry.total_tasks_executed = registry.total_tasks_executed + 1;
        
        event::emit(TaskExecuted {
            task_id,
            executor: ctx.sender(),
            timestamp: current_time,
            amount,
            relayer_fee_paid: fee_amount
        });

        object::delete(id);
    }
    
    public entry fun cancel_task(
        mut task: ScheduledTask,
        registry: &mut TaskRegistry,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == task.sender, EUnauthorized);
        assert!(task.status == STATUS_PENDING, EInvalidStatus);
        
        // Update task status
        task.status = STATUS_CANCELLED;
        
        let current_time = clock::timestamp_ms(clock);
        
        let ScheduledTask {
            id,
            sender,
            recipient: _,
            mut balance,
            execute_at: _,
            relayer_fee,
            status: _,
            attempt_count: _,
            last_failure_reason: _,
            created_at: _,
            metadata: _
        } = task;
        
        let task_id = object::uid_to_inner(&id);

        balance::join(&mut balance, relayer_fee);
        let refund_coin = coin::from_balance(balance, ctx);
        transfer::public_transfer(refund_coin, sender);
        
        // Update registry statistics
        registry.total_tasks_cancelled = registry.total_tasks_cancelled + 1;
        
        event::emit(TaskCancelled {
            task_id,
            sender,
            timestamp: current_time
        });

        object::delete(id);
    }

    //
    // Failure & Reschedule APIs for Relayer support
    //
    public entry fun reschedule_task(
        task: &mut ScheduledTask,
        new_execute_at: u64,
        registry: &mut TaskRegistry,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only task sender or registry admin may reschedule
        assert!(!registry.is_paused, EContractPaused);
        assert!(ctx.sender() == task.sender || ctx.sender() == registry.admin, EUnauthorized);

        let current_time = clock::timestamp_ms(clock);
        assert!(new_execute_at > current_time, EInvalidExecutionTime);

        task.execute_at = new_execute_at;
        // clear previous failure reason when rescheduling
        task.last_failure_reason = vector::empty<u8>();
    }

    public entry fun mark_task_failed(
        task: &mut ScheduledTask,
        registry: &mut TaskRegistry,
        reason: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Mark a pending task as failed and record failure info
        assert!(task.status == STATUS_PENDING, EInvalidStatus);
        task.status = STATUS_FAILED;
        task.attempt_count = task.attempt_count + 1;

        let task_id = object::uid_to_inner(&task.id);
        let current_time = clock::timestamp_ms(clock);

        // Emit event with provided reason. Do not attempt to move the same vector
        // into the storage field (copying vectors is expensive); store an empty placeholder.
        event::emit(TaskFailed {
            task_id,
            executor: ctx.sender(),
            timestamp: current_time,
            reason
        });

        task.last_failure_reason = vector::empty<u8>();
        registry.total_tasks_failed = registry.total_tasks_failed + 1;
    }

    // ===== Admin Functions =====
    public entry fun pause(
        _admin_cap: &AdminCap,
        registry: &mut TaskRegistry,
        _ctx: &mut TxContext
    ) {
        registry.is_paused = true;
    }

    public entry fun unpause(
        _admin_cap: &AdminCap,
        registry: &mut TaskRegistry,
        _ctx: &mut TxContext
    ) {
        registry.is_paused = false;
    }

    public entry fun set_min_relayer_fee(
        _admin_cap: &AdminCap,
        registry: &mut TaskRegistry,
        new_fee: u64,
        _ctx: &mut TxContext
    ) {
        registry.min_relayer_fee = new_fee;
    }

    public entry fun update_admin(
        _admin_cap: &AdminCap,
        registry: &mut TaskRegistry,
        new_admin: address,
        _ctx: &mut TxContext
    ) {
        registry.admin = new_admin;
    }

    // ===== View Functions =====
    public fun get_task_details(task: &ScheduledTask): (address, address, u64, u64, u8, u64, u64, vector<u8>) {
        (
            task.sender,
            task.recipient,
            balance::value(&task.balance),
            task.execute_at,
            task.status,
            task.created_at,
            task.attempt_count,
            task.last_failure_reason
        )
    }
    
    public fun get_task_status(task: &ScheduledTask): u8 {
        task.status
    }

    public fun get_task_metadata(task: &ScheduledTask): vector<u8> {
        task.metadata
    }
    
    public fun is_ready_to_execute(task: &ScheduledTask, clock: &Clock): bool {
        clock::timestamp_ms(clock) >= task.execute_at && task.status == STATUS_PENDING
    }

    public fun get_registry_stats(registry: &TaskRegistry): (u64, u64, u64, u64, u64, u64, u64, bool) {
        (
            registry.total_tasks_created,
            registry.total_tasks_executed,
            registry.total_tasks_cancelled,
            registry.total_tasks_failed,
            registry.total_volume,
            registry.total_fees_paid,
            registry.min_relayer_fee,
            registry.is_paused
        )
    }

    public fun get_registry_admin(registry: &TaskRegistry): address {
        registry.admin
    }

    public fun is_paused(registry: &TaskRegistry): bool {
        registry.is_paused
    }

    public fun get_min_relayer_fee(registry: &TaskRegistry): u64 {
        registry.min_relayer_fee
    }

    // ===== Status Helper Functions =====
    public fun status_pending(): u8 { STATUS_PENDING }
    public fun status_executed(): u8 { STATUS_EXECUTED }
    public fun status_cancelled(): u8 { STATUS_CANCELLED }
    public fun status_failed(): u8 { STATUS_FAILED }

    // ===== Phase 7: Escrow Tracking & Monitoring Functions =====
    
    /// Get the task ID
    public fun get_task_id(task: &ScheduledTask): ID {
        object::uid_to_inner(&task.id)
    }

    /// Get task balance (amount escrowed for recipient)
    public fun get_task_balance(task: &ScheduledTask): u64 {
        balance::value(&task.balance)
    }

    /// Get task relayer fee amount
    public fun get_task_relayer_fee(task: &ScheduledTask): u64 {
        balance::value(&task.relayer_fee)
    }

    /// Get detailed escrow information for a task
    /// Returns: (balance, relayer_fee, execute_at, status)
    public fun get_task_escrow_details(task: &ScheduledTask): (u64, u64, u64, u8) {
        (
            balance::value(&task.balance),
            balance::value(&task.relayer_fee),
            task.execute_at,
            task.status
        )
    }

    /// Calculate total escrowed amount (balance + relayer_fee)
    public fun get_task_total_escrow(task: &ScheduledTask): u64 {
        balance::value(&task.balance) + balance::value(&task.relayer_fee)
    }

    /// Validate task integrity
    /// Checks: balance > 0, status is valid, execute_at > created_at
    public fun validate_task_integrity(task: &ScheduledTask, registry: &TaskRegistry): bool {
        let has_balance = balance::value(&task.balance) > 0;
        let has_valid_fee = balance::value(&task.relayer_fee) >= registry.min_relayer_fee;
        let has_valid_time = task.execute_at > task.created_at;
        let has_valid_status = task.status <= STATUS_FAILED;
        
        has_balance && has_valid_fee && has_valid_time && has_valid_status
    }

    /// Check clock drift between Sui clock and reference time
    /// Returns: (drift_ms, is_within_threshold)
    /// drift_ms is absolute difference, is_within_threshold is true if drift < MAX_CLOCK_DRIFT_MS
    public fun check_clock_drift(clock: &Clock, reference_time: u64): (u64, bool) {
        let current_time = clock::timestamp_ms(clock);
        let drift = if (current_time > reference_time) {
            current_time - reference_time
        } else {
            reference_time - current_time
        };
        let is_valid = drift < MAX_CLOCK_DRIFT_MS;
        (drift, is_valid)
    }

    /// Get escrow status summary for frontend/relayer
    /// Returns: (status, is_ready_to_execute, total_locked_amount)
    public fun get_escrow_status_summary(task: &ScheduledTask, clock: &Clock): (u8, bool, u64) {
        let current_time = clock::timestamp_ms(clock);
        let is_ready = current_time >= task.execute_at && task.status == STATUS_PENDING;
        let total_locked = balance::value(&task.balance) + balance::value(&task.relayer_fee);
        (task.status, is_ready, total_locked)
    }

    /// Get task sender address
    public fun get_task_sender(task: &ScheduledTask): address {
        task.sender
    }

    /// Get task recipient address
    public fun get_task_recipient(task: &ScheduledTask): address {
        task.recipient
    }

    /// Get task execution time
    public fun get_task_execute_at(task: &ScheduledTask): u64 {
        task.execute_at
    }

    /// Get task created time
    public fun get_task_created_at(task: &ScheduledTask): u64 {
        task.created_at
    }

    /// Get task attempt count
    public fun get_task_attempt_count(task: &ScheduledTask): u64 {
        task.attempt_count
    }

    /// Check if task is in pending status (escrow is locked)
    public fun is_escrow_locked(task: &ScheduledTask): bool {
        task.status == STATUS_PENDING
    }

    /// Get time remaining until task execution (returns 0 if already due)
    public fun get_time_until_execution(task: &ScheduledTask, clock: &Clock): u64 {
        let current_time = clock::timestamp_ms(clock);
        if (current_time >= task.execute_at) {
            0
        } else {
            task.execute_at - current_time
        }
    }

    /// Get max clock drift threshold constant
    public fun get_max_clock_drift(): u64 {
        MAX_CLOCK_DRIFT_MS
    }
}
