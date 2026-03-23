# Project Summary: Patient Appointment Scheduling System (Phase 2)
**Goal:** A high-performance, real-time healthcare management system that eliminates physical waiting rooms through AI-driven queue optimization and proactive patient notifications.

## 🚀 Fully Working Modules
The following features are fully implemented and integrated with the backend:
1. **AI-Powered Duration Prediction**: Dynamically predicts how long a consultation will take based on:
   - Doctor's historical average (using Exponential Moving Average - EMA).
   - Symptom complexity analysis (keyword-weighted scoring).
   - Patient type (New vs. Follow-up).
2. **Smart Arrival Service**: Calculates the optimal time for a patient to leave their house based on live queue speed, transit time, and a safety buffer.
3. **Virtual Waiting Room**: Patients can check-in remotely, track their real-time position, and see a live-decrementing ETA.
4. **Live Queue Management (Doctor's View)**:
   - **In-Progress Tracking**: Real-time monitoring of active consultations.
   - **Missed Patient Logic**: Automatically repositions a missed patient 5 slots back instead of cancelling, ensuring zero patient loss.
5. **Global Notification System**: Real-time "Popup" alerts (Your Turn / You're Next) that trigger across the entire application using 15-second polling.
6. **Post-Consultation Records**: Automatic recording of prescriptions, diagnoses, and follow-up recommendations which instantly appear in the patient’s profile.

---

## 🧠 Role of DAA (Design and Analysis of Algorithms)
This project leverages several core DAA principles to solve real-world scheduling problems:

### 1. Predictive Analysis & Weighting (Regression-like Heuristics)
- **Algorithm**: Weighted Heuristic Scoring.
- **Application**: Symptoms are parsed for keywords, and each keyword has a pre-assigned "complexity score." The system uses these weights to adjust the base consultation time, demonstrating how **Heuristic Algorithms** can improve prediction accuracy over simple averages.

### 2. Statistical Smoothing (Moving Average Algorithms)
- **Algorithm**: Exponential Moving Average (EMA).
- **Application**: The system doesn't just take a simple mean of past durations (which is slow to adapt). It uses a smoothing factor ($\alpha = 0.1$) to give more weight to recent consultations, reflecting how **Incremental Algorithms** handle streaming data.

### 3. Queueing Theory & Dynamic Programming
- **Algorithm**: Real-time State Adjustment.
- **Application**: The ETA is calculated as $WaitTime = \max(5, Predicted - Elapsed) + \sum(PatientsAhead)$. This is a dynamic calculation that updates the state based on the current time ($t$), showcasing **Real-time Optimization**.

### 4. Efficient Data Structure Manipulation
- **Algorithm**: Array/List Shifting (Rearrangement).
- **Application**: When a patient is marked "Missed," the system implements a **Shifting Algorithm** to reinsert the patient 5 slots back. 
- **Complexity**: $O(K)$ where $K=5$, making it highly efficient for live updates without needing to rebuild the entire queue ($O(N)$).

### 5. Time Complexity Optimization
- **Optimization**: I minimized database round-trips by batching queue updates and using calculated fields to ensure the frontend receives a "ready-to-display" state, reducing the client-side computational load from $O(N)$ to $O(1)$.

---

## ⚡ Dynamic vs. Greedy Algorithms (TC Savings)
To ensure the system remains responsive even with 100+ concurrent patients, we intentionally avoided "Greedy" approaches in favor of **Dynamic and Incremental Algorithms**:

| Feature | Greedy Approach (Slow) | Our Dynamic Approach (Fast) | TC Saving |
| :--- | :--- | :--- | :--- |
| **Queue ETA** | Re-calculating entire list from scratch for every patient ($O(N^2)$). | Single-pass accumulation of wait times ($O(N)$). | **Linear Speedup** |
| **Duration Prediction** | Re-averaging entire history window ($O(W)$). | Exponential Moving Average ($O(1)$ update). | **Constant Time** |
| **Missed Patients** | Full database re-indexing and sorting ($O(N)$). | Targeted subset shifting ($O(K)$ where $K=5$). | **Minimal Latency** |
| **Real-time Updates** | Constant data fetching for every field ($O(\text{bandwidth})$). | Priority-based 15s polling for high-value alerts. | **Network Efficiency** |

### Why this matters for the Viva:
- **Greedy Algorithms** make decisions based on the immediate best choice without considering future efficiency, often leading to bottlenecking as the queue grows.
- **Dynamic Programming/Incremental Logic** (like our EMA and cumulative wait sums) "remembers" previous states to process new information in constant or linear time, which is critical for a high-availability healthcare system.
