-- Week 4: Billing & Payments Migration
ALTER TABLE appointments ADD COLUMN payment_status ENUM('UNPAID', 'PENDING', 'PAID', 'REFUNDED') DEFAULT 'UNPAID';
ALTER TABLE appointments ADD COLUMN payment_amount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE appointments ADD COLUMN stripe_payment_intent_id VARCHAR(255) NULL;

-- Payment Transactions Log
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    provider ENUM('STRIPE', 'PAYPAL', 'CASH') NOT NULL,
    provider_transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
