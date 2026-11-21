let courseCount = 0;
    let gpaCourseCount = 0;
    let saveTimer = null;
    let restoringState = false;
    let activeCalculator = "internal-marks";
    const storageKey = "campusconnect-internal-marks-calculator";

    document.addEventListener("DOMContentLoaded", () => {
        let savedState = null;
        try {
            savedState = JSON.parse(localStorage.getItem(storageKey) || "null");
        } catch (error) {
            setStorageStatus("Could not read saved calculator data.");
            console.error("Could not load calculator data from this browser.", error);
        }
        if (savedState && typeof savedState === "object") {
            restoreCalculator(savedState);
        }
        if (!document.querySelector(".calc-card")) {
            addCourseCard();
        }
        if (!document.querySelector(".gpa-course-row[data-course-id]")) {
            addGpaCourse();
        }
        
        document.getElementById("btn-add-course").addEventListener("click", () => {
            addCourseCard();
        });
        document.getElementById("btn-add-gpa-course").addEventListener("click", () => addGpaCourse());
        document.querySelectorAll(".calculator-tab").forEach(button => {
            button.addEventListener("click", () => setCalculatorView(button.dataset.view));
        });
        document.querySelectorAll("#cgpa-view input").forEach(input => {
            input.addEventListener("input", calculateCGPA);
        });
    });

    function restoreCalculator(state) {
        restoringState = true;
        (Array.isArray(state.courses) ? state.courses : []).forEach(course => {
            addCourseCard();
            const id = courseCount;
            const card = document.getElementById(`course-card-${id}`);

            card.querySelector(".course-name").value = course.name || "";
            card.querySelector(".course-type").value = course.type || "theory-3";

            ["quizzes", "assignments", "lab-assign"].forEach(type => {
                const container = document.getElementById(`${type}-rows-${id}`);
                container.innerHTML = "";
                (course.rows && course.rows[type] || []).forEach(row => {
                    addMarkRow(id, type, null, row);
                });
            });

            card.querySelector(".mid-obt").value = course.midObt ?? "";
            card.querySelector(".mid-tot").value = course.midTot || 25;
            card.querySelector(".term-obt").value = course.termObt ?? "";
            card.querySelector(".term-tot").value = course.termTot || 50;
            card.querySelector(".labmid-obt").value = course.labMidObt ?? "";
            card.querySelector(".labmid-tot").value = course.labMidTot || 25;
            card.querySelector(".labterm-obt").value = course.labTermObt ?? "";
            card.querySelector(".labterm-tot").value = course.labTermTot || 50;
            toggleSections(id);
            calculateCard(id);
        });
        (Array.isArray(state.gpaCourses) && state.gpaCourses.length ? state.gpaCourses : [{}]).forEach(course => addGpaCourse(course));
        const cgpa = state.cgpa || {};
        document.getElementById("previous-credits").value = cgpa.previousCredits ?? "";
        document.getElementById("previous-cgpa").value = cgpa.previousCgpa ?? "";
        document.getElementById("semester-credits").value = cgpa.semesterCredits ?? "";
        document.getElementById("semester-gpa").value = cgpa.semesterGpa ?? "";
        if (["internal-marks", "gpa", "cgpa"].includes(state.activeCalculator)) {
            activeCalculator = state.activeCalculator;
        }
        setCalculatorView(activeCalculator);
        restoringState = false;
        calculateGPA();
        calculateCGPA();
    }

    function setCalculatorView(view) {
        if (!["internal-marks", "gpa", "cgpa"].includes(view)) return;
        activeCalculator = view;
        document.querySelectorAll(".calculator-tab").forEach(button => {
            const isActive = button.dataset.view === view;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
        document.querySelectorAll(".calculator-view").forEach(section => {
            section.hidden = section.id !== `${view}-view`;
        });
        scheduleCalculatorSave();
    }

    function addCourseCard() {
        courseCount++;
        const container = document.getElementById("course-cards-container");
        
        const card = document.createElement("div");
        card.className = "calc-card";
        card.id = `course-card-${courseCount}`;
        
        // Initial HTML template representing the portal marks inputs
        card.innerHTML = `
            <button class="btn-remove-course" onclick="removeCourseCard(${courseCount})" title="Remove Course">
                <i class="fas fa-times"></i>
            </button>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; align-items: center; margin-right: 35px;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 12px; margin-bottom: 4px;"><i class="fas fa-book"></i> Course Name</label>
                    <input type="text" placeholder="e.g. Database Systems" class="input-compact course-name" style="width: 100%;" oninput="scheduleCalculatorSave()">
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 12px; margin-bottom: 4px;"><i class="fas fa-sliders-h"></i> Course Type / Credits</label>
                    <select class="input-compact course-type" style="width: 100%;" onchange="toggleSections(${courseCount})">
                        <option value="theory-3">Theory Only (3 Credits)</option>
                        <option value="theory-2">Theory Only (2 Credits)</option>
                        <option value="blended-4">Theory + Lab (4 Credits: 3T + 1L)</option>
                        <option value="blended-3">Theory + Lab (3 Credits: 2T + 1L)</option>
                    </select>
                </div>
            </div>

            <!-- Dynamic Evaluation Areas -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-top: 20px;">
                
                <!-- Theory evaluation -->
                <div class="component-section" id="theory-section-${courseCount}">
                    <h4 class="component-title">
                        <span><i class="fas fa-university"></i> Theory Aggregate</span>
                        <span id="theory-agg-${courseCount}" style="color: var(--primary);">0.0%</span>
                    </h4>
                    
                    <!-- Quizzes Table -->
                    <div style="margin-bottom: 14px;">
                        <label style="font-size: 11px; font-weight: 700; color: var(--dark); display: block; margin-bottom: 6px;">Quizzes (15% Weight)</label>
                        <div id="quizzes-rows-${courseCount}">
                            <!-- Dynamic rows -->
                        </div>
                        <button type="button" class="btn-add-row" onclick="addMarkRow(${courseCount}, 'quizzes')">
                            <i class="fas fa-plus"></i> Add Quiz Row
                        </button>
                    </div>

                    <!-- Assignments Table -->
                    <div style="margin-bottom: 14px; border-top: 1px solid var(--border); padding-top: 12px;">
                        <label style="font-size: 11px; font-weight: 700; color: var(--dark); display: block; margin-bottom: 6px;">Assignments (10% Weight)</label>
                        <div id="assignments-rows-${courseCount}">
                            <!-- Dynamic rows -->
                        </div>
                        <button type="button" class="btn-add-row" onclick="addMarkRow(${courseCount}, 'assignments')">
                            <i class="fas fa-plus"></i> Add Assignment Row
                        </button>
                    </div>

                    <!-- Mid & Terminal Exam -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid var(--border); padding-top: 12px;">
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--dark); display: block; margin-bottom: 6px;">Midterm (25%)</label>
                            <div style="display: flex; gap: 4px; align-items: center;">
                                <input type="number" min="0" step="0.5" placeholder="Obt" class="input-compact mid-obt" oninput="calculateCard(${courseCount})">
                                <span style="font-size: 11px; color: var(--gray);">/</span>
                                <input type="number" min="1" placeholder="Tot" value="25" class="input-compact mid-tot" oninput="calculateCard(${courseCount})">
                            </div>
                        </div>
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--dark); display: block; margin-bottom: 6px;">Terminal (50%)</label>
                            <div style="display: flex; gap: 4px; align-items: center;">
                                <input type="number" min="0" step="0.5" placeholder="Obt" class="input-compact term-obt" oninput="calculateCard(${courseCount})">
                                <span style="font-size: 11px; color: var(--gray);">/</span>
                                <input type="number" min="1" placeholder="Tot" value="50" class="input-compact term-tot" oninput="calculateCard(${courseCount})">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Lab evaluation -->
                <div class="component-section" id="lab-section-${courseCount}" style="display: none;">
                    <h4 class="component-title">
                        <span><i class="fas fa-flask"></i> Lab Aggregate</span>
                        <span id="lab-agg-${courseCount}" style="color: var(--primary);">0.0%</span>
                    </h4>

                    <!-- Lab Assignments Table -->
                    <div style="margin-bottom: 14px;">
                        <label style="font-size: 11px; font-weight: 700; color: var(--dark); display: block; margin-bottom: 6px;">Lab Assignments (25% Weight)</label>
                        <div id="lab-assign-rows-${courseCount}">
                            <!-- Dynamic rows -->
                        </div>
                        <button type="button" class="btn-add-row" onclick="addMarkRow(${courseCount}, 'lab-assign')">
                            <i class="fas fa-plus"></i> Add Lab Row
                        </button>
                    </div>

                    <!-- Lab Mid & Term -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid var(--border); padding-top: 12px;">
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--dark); display: block; margin-bottom: 6px;">Lab Mid (25%)</label>
                            <div style="display: flex; gap: 4px; align-items: center;">
                                <input type="number" min="0" step="0.5" placeholder="Obt" class="input-compact labmid-obt" oninput="calculateCard(${courseCount})">
                                <span style="font-size: 11px; color: var(--gray);">/</span>
                                <input type="number" min="1" placeholder="Tot" value="25" class="input-compact labmid-tot" oninput="calculateCard(${courseCount})">
                            </div>
                        </div>
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--dark); display: block; margin-bottom: 6px;">Lab Term (50%)</label>
                            <div style="display: flex; gap: 4px; align-items: center;">
                                <input type="number" min="0" step="0.5" placeholder="Obt" class="input-compact labterm-obt" oninput="calculateCard(${courseCount})">
                                <span style="font-size: 11px; color: var(--gray);">/</span>
                                <input type="number" min="1" placeholder="Tot" value="50" class="input-compact labterm-tot" oninput="calculateCard(${courseCount})">
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Calculated Course Output -->
            <div style="margin-top: 20px; padding-top: 12px; border-top: 1px dashed var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; gap: 15px; font-size: 13px; color: var(--gray);">
                    <span>Blended Score: <strong id="course-blend-${courseCount}" style="color: var(--dark);">0.0%</strong></span>
                    <span>GP: <strong id="course-gp-${courseCount}" style="color: var(--dark);">0.00</strong></span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div id="course-alert-${courseCount}" style="display: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(239,68,68,0.1); color: var(--danger); border: 1px solid rgba(239,68,68,0.15);">
                        <!-- Alert content dynamic -->
                    </div>
                    <span id="course-grade-${courseCount}" class="badge-grade grade-f">F</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);

        // Pre-populate with 4 quizzes, 4 assignments by default (matching standard semester like in screenshot!)
        for (let i = 1; i <= 4; i++) {
            addMarkRow(courseCount, 'quizzes', i);
            addMarkRow(courseCount, 'assignments', i);
            addMarkRow(courseCount, 'lab-assign', i);
        }

        calculateCard(courseCount);
    }

    function addMarkRow(courseId, type, num = null, savedRow = null) {
        const container = document.getElementById(`${type}-rows-${courseId}`);
        if (!container) return;

        const count = container.children.length + 1;
        const index = num || Date.now() + Math.random();

        const row = document.createElement("div");
        row.className = "marks-row";
        row.id = `row-${courseId}-${type}-${index}`;

        let placeholderObt = "";
        let placeholderTot = "";
        
        // Dynamic placeholders matching typical marks in CUOnline portal
        if (type === 'quizzes') {
            placeholderObt = "Obt";
            placeholderTot = "Total";
        } else if (type === 'assignments') {
            placeholderObt = "Obt";
            placeholderTot = "Total";
        } else {
            placeholderObt = "Obt";
            placeholderTot = "Total";
        }

        row.innerHTML = `
            <input type="text" value="${type.slice(0, 3).toUpperCase()} ${count}" class="input-compact input-title" style="flex: 1; min-width: 80px;" placeholder="Name" oninput="scheduleCalculatorSave()">
            <input type="number" min="0" step="0.5" placeholder="${placeholderObt}" class="input-compact mark-obt" oninput="calculateCard(${courseId})">
            <span style="font-size: 11px; color: var(--gray);">/</span>
            <input type="number" min="0.1" step="0.5" placeholder="${placeholderTot}" class="input-compact mark-tot" oninput="calculateCard(${courseId})">
            <button type="button" class="btn-remove-row" onclick="removeMarkRow(${courseId}, '${type}', '${index}')" title="Remove row" aria-label="Remove row">×</button>
        `;

        container.appendChild(row);
        if (savedRow) {
            row.querySelector(".input-title").value = savedRow.name || "";
            row.querySelector(".mark-obt").value = savedRow.obt ?? "";
            row.querySelector(".mark-tot").value = savedRow.tot ?? "";
        }
        calculateCard(courseId);
    }

    function removeMarkRow(courseId, type, index) {
        const row = document.getElementById(`row-${courseId}-${type}-${index}`);
        if (row) {
            row.remove();
            calculateCard(courseId);
        }
    }

    function removeCourseCard(id) {
        const card = document.getElementById(`course-card-${id}`);
        if (card) {
            card.remove();
            calculateSGPA();
        }
    }

    function toggleSections(id) {
        const typeSelect = document.querySelector(`#course-card-${id} .course-type`);
        const labSection = document.getElementById(`lab-section-${id}`);
        
        if (typeSelect.value.startsWith("blended")) {
            labSection.style.display = "block";
        } else {
            labSection.style.display = "none";
        }
        
        calculateCard(id);
    }

    // Helper to validate obtained/total marks and calculate weighted contributions
    function validateObtainedTotal(obtInput, totInput) {
        const obt = parseFloat(obtInput.value);
        const tot = parseFloat(totInput.value);
        const hasObt = Number.isFinite(obt);
        const hasTot = Number.isFinite(tot);

        obtInput.setCustomValidity("");
        obtInput.removeAttribute("aria-invalid");
        obtInput.removeAttribute("title");

        if (hasObt && hasTot && obt > tot) {
            const message = "Obtained marks cannot be more than total marks.";
            obtInput.setCustomValidity(message);
            obtInput.setAttribute("aria-invalid", "true");
            obtInput.title = message;
            return false;
        }

        return true;
    }

    function getWeightedAggregate(rowsId) {
        const container = document.getElementById(rowsId);
        if (!container) return { obtained: 0, total: 0, percent: 0 };

        const rows = container.querySelectorAll(".marks-row");
        let totalObt = 0;
        let totalTot = 0;

        rows.forEach(row => {
            const obtInput = row.querySelector(".mark-obt");
            const totInput = row.querySelector(".mark-tot");
            const obtVal = parseFloat(obtInput.value);
            const totVal = parseFloat(totInput.value);
            const validMarks = validateObtainedTotal(obtInput, totInput);

            const obt = Number.isFinite(obtVal) ? Math.max(0, obtVal) : 0;
            const tot = Number.isFinite(totVal) ? Math.max(0, totVal) : 0;

            if (validMarks && tot > 0) {
                totalObt += obt;
                totalTot += tot;
            }
        });

        const percent = totalTot > 0 ? (totalObt / totalTot) * 100 : 0;
        return { obtained: totalObt, total: totalTot, percent: percent };
    }

    function getExamValue(obtInput, totInput) {
        const obt = parseFloat(obtInput.value);
        const tot = parseFloat(totInput.value);
        if (!validateObtainedTotal(obtInput, totInput)) return 0;

        const obtained = Number.isFinite(obt) ? Math.max(0, obt) : 0;
        const total = Number.isFinite(tot) ? Math.max(0, tot) : 0;
        if (total <= 0) return 0;
        return (obtained / total) * 100;
    }

    function calculateCard(id) {
        const card = document.getElementById(`course-card-${id}`);
        if (!card) return;

        const typeSelect = card.querySelector(".course-type").value;
        
        // 1. Quizzes (15%) and Assignments (10%)
        const quizData = getWeightedAggregate(`quizzes-rows-${id}`);
        const assignData = getWeightedAggregate(`assignments-rows-${id}`);

        // 2. Mids and Terminals
        const midObt = card.querySelector(".mid-obt");
        const midTot = card.querySelector(".mid-tot");
        const termObt = card.querySelector(".term-obt");
        const termTot = card.querySelector(".term-tot");

        const midPercent = getExamValue(midObt, midTot);
        const termPercent = getExamValue(termObt, termTot);

        // Theory Aggregate = Quizzes 15% + Assignments 10% + Mids 25% + Terminal 50%
        const quizContribution = quizData.percent * 0.15;
        const assignContribution = assignData.percent * 0.10;
        const midContribution = midPercent * 0.25;
        const termContribution = termPercent * 0.50;

        const theoryAgg = quizContribution + assignContribution + midContribution + termContribution;
        document.getElementById(`theory-agg-${id}`).textContent = `${theoryAgg.toFixed(1)}%`;

        // 3. Lab Component (Assignments 25% + Mid 25% + Terminal 50%)
        const labAssignData = getWeightedAggregate(`lab-assign-rows-${id}`);
        const labMidObt = card.querySelector(".labmid-obt");
        const labMidTot = card.querySelector(".labmid-tot");
        const labTermObt = card.querySelector(".labterm-obt");
        const labTermTot = card.querySelector(".labterm-tot");

        const labMidPercent = getExamValue(labMidObt, labMidTot);
        const labTermPercent = getExamValue(labTermObt, labTermTot);

        const labAssignContrib = labAssignData.percent * 0.25;
        const labMidContrib = labMidPercent * 0.25;
        const labTermContrib = labTermPercent * 0.50;

        const labAgg = labAssignContrib + labMidContrib + labTermContrib;
        document.getElementById(`lab-agg-${id}`).textContent = `${labAgg.toFixed(1)}%`;

        // Blending calculations
        let blendedFinal = 0;
        let credits = 3;
        let failedComponent = false;
        let failedMessage = "";

        if (typeSelect === "theory-3") {
            blendedFinal = theoryAgg;
            credits = 3;
        } else if (typeSelect === "theory-2") {
            blendedFinal = theoryAgg;
            credits = 2;
        } else if (typeSelect === "blended-4") {
            credits = 4;
            blendedFinal = (theoryAgg * 0.75) + (labAgg * 0.25);
            
            // Critical passing condition: must score >= 50% in both components separately
            const theoryPassed = theoryAgg >= 50;
            const labPassed = labAgg >= 50;
            if (!theoryPassed && !labPassed) {
                failedComponent = true;
                failedMessage = "Failed Both Components";
            } else if (!theoryPassed) {
                failedComponent = true;
                failedMessage = "Failed Theory Component";
            } else if (!labPassed) {
                failedComponent = true;
                failedMessage = "Failed Lab Component";
            }
        } else if (typeSelect === "blended-3") {
            credits = 3;
            blendedFinal = (theoryAgg * (2/3)) + (labAgg * (1/3));
            
            // Critical passing condition: must score >= 50% in both components separately
            const theoryPassed = theoryAgg >= 50;
            const labPassed = labAgg >= 50;
            if (!theoryPassed && !labPassed) {
                failedComponent = true;
                failedMessage = "Failed Both Components";
            } else if (!theoryPassed) {
                failedComponent = true;
                failedMessage = "Failed Theory Component";
            } else if (!labPassed) {
                failedComponent = true;
                failedMessage = "Failed Lab Component";
            }
        }

        // Apply grading scale
        let gp = 0;
        let grade = "F";
        let gradeClass = "grade-f";

        if (failedComponent) {
            gp = 0.0;
            grade = "F";
            gradeClass = "grade-f";
        } else {
            const finalPct = Math.round(blendedFinal * 100) / 100;
            if (finalPct >= 85) { gp = 4.0; grade = "A"; gradeClass = "grade-a"; }
            else if (finalPct >= 80) { gp = 3.66; grade = "A-"; gradeClass = "grade-a"; }
            else if (finalPct >= 75) { gp = 3.33; grade = "B+"; gradeClass = "grade-b"; }
            else if (finalPct >= 71) { gp = 3.0; grade = "B"; gradeClass = "grade-b"; }
            else if (finalPct >= 68) { gp = 2.66; grade = "B-"; gradeClass = "grade-b"; }
            else if (finalPct >= 64) { gp = 2.33; grade = "C+"; gradeClass = "grade-c"; }
            else if (finalPct >= 61) { gp = 2.0; grade = "C"; gradeClass = "grade-c"; }
            else if (finalPct >= 58) { gp = 1.66; grade = "C-"; gradeClass = "grade-c"; }
            else if (finalPct >= 54) { gp = 1.33; grade = "D+"; gradeClass = "grade-d"; }
            else if (finalPct >= 50) { gp = 1.0; grade = "D"; gradeClass = "grade-d"; }
            else { gp = 0.0; grade = "F"; gradeClass = "grade-f"; }
        }

        // Update UI of the card
        document.getElementById(`course-blend-${id}`).textContent = `${blendedFinal.toFixed(1)}%`;
        document.getElementById(`course-gp-${id}`).textContent = gp.toFixed(2);
        
        const gradeBadge = document.getElementById(`course-grade-${id}`);
        gradeBadge.className = `badge-grade ${gradeClass}`;
        gradeBadge.textContent = grade;

        const alertBadge = document.getElementById(`course-alert-${id}`);
        if (failedComponent) {
            alertBadge.textContent = failedMessage;
            alertBadge.style.display = "block";
        } else {
            alertBadge.style.display = "none";
        }

        // Save credits and GP data directly to the card elements for easy aggregation
        card.setAttribute("data-credits", credits);
        card.setAttribute("data-gp", gp);
        card.setAttribute("data-passed", gp > 0 ? "true" : "false");

        calculateSGPA();
    }

    function calculateSGPA() {
        const cards = document.querySelectorAll(".calc-card");
        let totalCredits = 0;
        let totalPoints = 0;
        let passedCredits = 0;
        let failedCredits = 0;

        cards.forEach(card => {
            const cr = parseFloat(card.getAttribute("data-credits")) || 0;
            const gp = parseFloat(card.getAttribute("data-gp")) || 0;
            const passed = card.getAttribute("data-passed") === "true";

            totalCredits += cr;
            totalPoints += (gp * cr);
            if (passed) {
                passedCredits += cr;
            } else {
                failedCredits += cr;
            }
        });

        const sgpa = totalCredits > 0 ? (totalPoints / totalCredits) : 0.0;

        document.getElementById("sgpa-value").textContent = sgpa.toFixed(2);
        document.getElementById("summary-credits").textContent = totalCredits;
        document.getElementById("summary-passed").textContent = passedCredits;
        document.getElementById("summary-failed").textContent = failedCredits;

        // Radial progress animation
        const circle = document.getElementById("radial-progress-bar");
        const radius = 34;
        const circumference = 2 * Math.PI * radius; // ~213.6
        const percent = sgpa / 4.0;
        const offset = circumference - (percent * circumference);
        circle.style.strokeDashoffset = Math.max(0, Math.min(circumference, offset));
        scheduleCalculatorSave();
    }

    function resetCalculator() {
        if (confirm("Are you sure you want to clear all courses and values?")) {
            const container = document.getElementById("course-cards-container");
            container.innerHTML = "";
            courseCount = 0;
            addCourseCard();
        }
    }

    function serializeCalculator() {
        return {
            activeCalculator,
            courses: Array.from(document.querySelectorAll(".calc-card")).map(card => {
                const id = card.id.replace("course-card-", "");
                const rows = {};
                ["quizzes", "assignments", "lab-assign"].forEach(type => {
                    rows[type] = Array.from(document.querySelectorAll(`#${type}-rows-${id} .marks-row`)).map(row => ({
                        name: row.querySelector(".input-title").value,
                        obt: row.querySelector(".mark-obt").value,
                        tot: row.querySelector(".mark-tot").value
                    }));
                });
                return {
                    name: card.querySelector(".course-name").value,
                    type: card.querySelector(".course-type").value,
                    rows,
                    midObt: card.querySelector(".mid-obt").value,
                    midTot: card.querySelector(".mid-tot").value,
                    termObt: card.querySelector(".term-obt").value,
                    termTot: card.querySelector(".term-tot").value,
                    labMidObt: card.querySelector(".labmid-obt").value,
                    labMidTot: card.querySelector(".labmid-tot").value,
                    labTermObt: card.querySelector(".labterm-obt").value,
                    labTermTot: card.querySelector(".labterm-tot").value
                };
            }),
            gpaCourses: Array.from(document.querySelectorAll(".gpa-course-row[data-course-id]")).map(row => ({
                name: row.querySelector(".course-name-input").value,
                grade: row.querySelector(".grade-input").value,
                credits: row.querySelector(".credit-input").value
            })),
            cgpa: {
                previousCredits: document.getElementById("previous-credits").value,
                previousCgpa: document.getElementById("previous-cgpa").value,
                semesterCredits: document.getElementById("semester-credits").value,
                semesterGpa: document.getElementById("semester-gpa").value
            }
        };
    }

    const comsatsGrades = [
        ["A", 4.00], ["A-", 3.66], ["B+", 3.33], ["B", 3.00], ["B-", 2.66],
        ["C+", 2.33], ["C", 2.00], ["C-", 1.66], ["D+", 1.33], ["D", 1.00], ["F", 0.00]
    ];

    function addGpaCourse(course = {}) {
        gpaCourseCount++;
        const row = document.createElement("div");
        row.className = "gpa-course-row";
        row.dataset.courseId = String(gpaCourseCount);
        row.innerHTML = `
            <input class="course-name-input" type="text" maxlength="100" placeholder="Course name" aria-label="Course name">
            <select class="grade-input" aria-label="Course grade">
                <option value="">Select grade</option>
                ${comsatsGrades.map(([grade, points]) => `<option value="${points.toFixed(2)}">${grade} (${points.toFixed(2)})</option>`).join("")}
            </select>
            <input class="credit-input" type="number" min="0.5" max="12" step="0.5" inputmode="decimal" placeholder="Credit hours (e.g. 3)" aria-label="Credit hours">
            <button type="button" class="btn-remove-row" aria-label="Remove course row" title="Remove course row">×</button>
        `;
        row.querySelector(".course-name-input").value = course.name || "";
        row.querySelector(".grade-input").value = course.grade || "";
        row.querySelector(".credit-input").value = course.credits ?? "";
        row.querySelectorAll("input, select").forEach(input => {
            input.addEventListener("input", calculateGPA);
            input.addEventListener("change", calculateGPA);
        });
        row.querySelector(".btn-remove-row").addEventListener("click", () => {
            row.remove();
            calculateGPA();
        });
        document.getElementById("gpa-courses").appendChild(row);
        calculateGPA();
    }

    function calculateGPA() {
        let totalCredits = 0;
        let qualityPoints = 0;
        document.querySelectorAll(".gpa-course-row[data-course-id]").forEach(row => {
            const grade = row.querySelector(".grade-input").value;
            const credits = Number(row.querySelector(".credit-input").value);
            if (grade !== "" && Number.isFinite(credits) && credits > 0) {
                totalCredits += credits;
                qualityPoints += Number(grade) * credits;
            }
        });
        document.getElementById("gpa-total-credits").textContent = totalCredits.toFixed(2);
        document.getElementById("gpa-quality-points").textContent = qualityPoints.toFixed(2);
        document.getElementById("gpa-value").textContent = totalCredits ? (qualityPoints / totalCredits).toFixed(2) : "—";
        scheduleCalculatorSave();
    }

    function calculateCGPA() {
        const previousCredits = Number(document.getElementById("previous-credits").value);
        const previousCgpa = Number(document.getElementById("previous-cgpa").value);
        const semesterCredits = Number(document.getElementById("semester-credits").value);
        const semesterGpa = Number(document.getElementById("semester-gpa").value);
        const hasPreviousCredits = document.getElementById("previous-credits").value !== "";
        const hasSemesterCredits = document.getElementById("semester-credits").value !== "";
        const error = document.getElementById("cgpa-error");
        const invalidCredits = (hasPreviousCredits && (!Number.isFinite(previousCredits) || previousCredits < 0))
            || (hasSemesterCredits && (!Number.isFinite(semesterCredits) || semesterCredits < 0));
        const invalidPreviousGpa = previousCredits > 0 && (!Number.isFinite(previousCgpa) || previousCgpa < 0 || previousCgpa > 4);
        const invalidSemesterGpa = semesterCredits > 0 && (!Number.isFinite(semesterGpa) || semesterGpa < 0 || semesterGpa > 4);

        if (invalidCredits || invalidPreviousGpa || invalidSemesterGpa) {
            error.textContent = "Enter non-negative credit hours and a CGPA/GPA between 0.00 and 4.00.";
            document.getElementById("cgpa-total-credits").textContent = "—";
            document.getElementById("cgpa-quality-points").textContent = "—";
            document.getElementById("cgpa-value").textContent = "—";
        } else {
            error.textContent = "";
            const totalCredits = (hasPreviousCredits ? previousCredits : 0) + (hasSemesterCredits ? semesterCredits : 0);
            const qualityPoints = (previousCredits > 0 ? previousCgpa * previousCredits : 0)
                + (semesterCredits > 0 ? semesterGpa * semesterCredits : 0);
            document.getElementById("cgpa-total-credits").textContent = totalCredits.toFixed(2);
            document.getElementById("cgpa-quality-points").textContent = qualityPoints.toFixed(2);
            document.getElementById("cgpa-value").textContent = totalCredits ? (qualityPoints / totalCredits).toFixed(2) : "—";
        }
        scheduleCalculatorSave();
    }

    function scheduleCalculatorSave() {
        if (restoringState) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(serializeCalculator()));
                setStorageStatus("Saved on this device");
            } catch (error) {
                setStorageStatus("Could not save data. Check browser storage settings.");
                console.error("Could not save calculator data in this browser.", error);
            }
        }, 400);
    }

    function setStorageStatus(message) {
        const status = document.getElementById("storage-status");
        if (status) status.textContent = message;
    }
