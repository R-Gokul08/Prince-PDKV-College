document.addEventListener('DOMContentLoaded', function() {
    // Prevent page refresh issues
    if (window.history.replaceState) window.history.replaceState(null, null, window.location.href);
    window.onbeforeunload = () => {};

    const supabase = window.supabase;
    const studentForm = document.getElementById('studentForm');
    const formSection = document.getElementById('student-form-section');
    const displaySection = document.getElementById('student-display-section');
    const studentProfile = document.getElementById('studentProfile');
    const backToFormBtn = document.getElementById('backToForm');
    const studentImageInput = document.getElementById('studentImage');
    const examDetails = document.getElementById('examDetails');
    const addExamBtn = document.getElementById('addExamBtn');
    const totalDays = document.getElementById('totalDays');
    const presentDays = document.getElementById('presentDays');
    const absentDays = document.getElementById('absentDays');
    const attendancePercentage = document.getElementById('attendancePercentage');

    // CHECK FOR PERSISTENT STUDENT ON LOAD
    if (sessionStorage.getItem('currentStudent')) {
        const student = JSON.parse(sessionStorage.getItem('currentStudent'));
        formSection.style.display = 'none';
        displaySection.style.display = 'block';
        displayStudentProfile(student);
        return;
    }

    // ATTENDANCE CALCULATION
    function calculateAttendance() {
        const total = parseInt(totalDays.value) || 0;
        const present = parseInt(presentDays.value) || 0;
        if (total > 0 && present <= total) {
            const percentage = ((present / total) * 100).toFixed(2);
            attendancePercentage.innerHTML = `<strong style="color: #4CAF50;">📊 Attendance: ${percentage}%</strong>`;
            absentDays.value = Math.max(0, total - present);
        }
    }
    totalDays.addEventListener('input', calculateAttendance);
    presentDays.addEventListener('input', calculateAttendance);

    // ADD EXAM
    addExamBtn.addEventListener('click', () => {
        const examEntry = document.createElement('div');
        examEntry.className = 'exam-entry';
        examEntry.innerHTML = `
            <input type="text" class="exam-subject" placeholder="Subject Name">
            <input type="number" class="exam-marks" placeholder="Marks" min="0" max="100">
            <select class="exam-result"><option value="">Pass/Fail</option><option value="Pass">✅ Pass</option><option value="Fail">❌ Fail</option></select>
            <select class="exam-type"><option value="">Sem/CIA</option><option value="Semester">📚 Semester</option><option value="CIA">📝 CIA</option></select>
            <button type="button" class="remove-exam" onclick="removeExam(this)">❌</button>
        `;
        examDetails.appendChild(examEntry);
    });

    window.removeExam = (button) => {
        if (examDetails.children.length > 1) button.parentElement.remove();
    };

    // FORM SUBMISSION
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault(); e.stopPropagation();
        
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '⏳ Saving...'; submitBtn.disabled = true;

        try {
            // COLLECT FORM DATA
            const dob = new Date(document.getElementById('dob').value).toLocaleDateString('en-GB');
            const formData = {
                name: document.getElementById('studentName').value.trim(),
                guardian_name: document.getElementById('guardianName').value.trim(),
                register_no: document.getElementById('registerNo').value.trim(),
                department: document.getElementById('department').value.trim(),
                year: parseInt(document.getElementById('year').value),
                phone: document.getElementById('phone').value.trim(),
                email: document.getElementById('email').value.trim(),
                linkedin: document.getElementById('linkedin').value.trim() || null,
                github: document.getElementById('github').value.trim() || null,
                dob, total_days: parseInt(totalDays.value) || 0,
                present_days: parseInt(presentDays.value) || 0,
                absent_days: parseInt(absentDays.value) || 0,
                attendance_percentage: parseFloat(attendancePercentage.textContent?.match(/[\d.]+/)?.[0] || 0)
            };

            // EXAMS
            const exams = Array.from(document.querySelectorAll('.exam-entry')).map(entry => {
                const subject = entry.querySelector('.exam-subject').value.trim();
                const marks = entry.querySelector('.exam-marks').value.trim();
                return subject && marks ? {
                    subject, marks: parseInt(marks),
                    result: entry.querySelector('.exam-result').value || 'Not Specified',
                    type: entry.querySelector('.exam-type').value || 'Not Specified'
                } : null;
            }).filter(Boolean);
            formData.exam_details = exams.length ? exams : null;

            // CHECK DUPLICATE
            const { data: existing } = await supabase
                .from('student_information').select('register_no')
                .eq('register_no', formData.register_no).maybeSingle();
            if (existing) return alert('❌ Register number already exists!');

            // IMAGE UPLOAD
            let imageUrl = null;
            if (studentImageInput.files[0]) {
                const file = studentImageInput.files[0];
                const fileExt = file.name.split('.').pop().toLowerCase();
                const fileName = `Student_images/${formData.register_no}.${fileExt}`;
                const { error } = await supabase.storage.from('Image_files').upload(fileName, file);
                if (!error) {
                    const { data: urlData } = supabase.storage.from('Image_files').getPublicUrl(fileName);
                    imageUrl = urlData.publicUrl;
                }
            }

            // SAVE TO DATABASE
            const { data: studentData } = await supabase
                .from('student_information').insert([{ ...formData, image_url: imageUrl }])
                .select().single();

            // PERSISTENT STORAGE + DISPLAY
            sessionStorage.setItem('currentStudent', JSON.stringify(studentData));
            formSection.style.display = 'none';
            displaySection.style.display = 'block';
            displaySection.scrollIntoView({ behavior: 'smooth' });
            displayStudentProfile(studentData);

        } catch (error) {
            alert('❌ Error: ' + error.message);
        } finally {
            submitBtn.innerHTML = originalText; submitBtn.disabled = false;
        }
    });

    // DISPLAY STUDENT PROFILE
    window.displayStudentProfile = (student) => {
        studentProfile.innerHTML = `
            <div style="text-align:center;margin-bottom:30px">
                <img src="${student.image_url || 'https://via.placeholder.com/150x150/4CAF50/FFFFFF?text=No+Image'}" alt="${student.name}" class="student-image">
                <h3 style="color:#2c3e50;margin:10px 0">${student.name}</h3>
                <h4 style="color:#4CAF50">${student.register_no}</h4>
            </div>
            <div class="student-info">
                <div class="info-item"><div class="info-label">Department</div><div class="info-value">${student.department}</div></div>
                <div class="info-item"><div class="info-label">Year</div><div class="info-value">${student.year}ᵗʰ Year</div></div>
                <div class="info-item"><div class="info-label">Guardian</div><div class="info-value">${student.guardian_name}</div></div>
                <div class="info-item"><div class="info-label">Phone</div><div class="info-value">${student.phone}</div></div>
                <div class="info-item"><div class="info-label">Email</div><div class="info-value">${student.email}</div></div>
                <div class="info-item"><div class="info-label">DOB</div><div class="info-value">${student.dob}</div></div>
                ${student.linkedin ? `<div class="info-item"><div class="info-label">LinkedIn</div><div class="info-value"><a href="${student.linkedin}" target="_blank">🔗 Profile</a></div></div>` : ''}
                ${student.github ? `<div class="info-item"><div class="info-label">GitHub</div><div class="info-value"><a href="${student.github}" target="_blank">🔗 Profile</a></div></div>` : ''}
            </div>
            <div class="attendance-grid" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px;border-radius:15px;color:white;margin:20px 0">
                <h3 style="margin-top:0;color:white">📅 Attendance</h3>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
                    <div style="background:rgba(255,255,255,0.2);padding:15px;border-radius:10px;text-align:center">
                        <div style="font-size:24px;font-weight:bold">${student.attendance_percentage}%</div><div>Attendance</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.2);padding:15px;border-radius:10px;text-align:center">
                        <div>${student.present_days}/${student.total_days}</div><div>Present/Total</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.2);padding:15px;border-radius:10px;text-align:center">
                        <div>${student.absent_days}</div><div>Absent Days</div>
                    </div>
                </div>
            </div>
            ${student.exam_details?.length ? `
            <div class="exams-grid">
                <h3>📊 Exam Results</h3>
                ${student.exam_details.map(exam => `
                    <div class="info-item" style="border-left:4px solid ${exam.result==='Pass'?'#4CAF50':'#f44336'}">
                        <div class="info-label">${exam.subject}</div>
                        <div class="info-value">${exam.marks}/100 - ${exam.result} (${exam.type})</div>
                    </div>
                `).join('')}
            </div>
            ` : `<div style="text-align:center;padding:40px;background:#f8f9fa;border-radius:15px;margin:25px 0"><p style="color:#6c757d;font-size:18px">📝 No exam details added</p></div>`}
        `;
    };

    // BACK TO FORM
    backToFormBtn.addEventListener('click', () => {
        sessionStorage.removeItem('currentStudent');
        formSection.style.display = 'block';
        displaySection.style.display = 'none';
        studentForm.reset();
        examDetails.innerHTML = examDetails.children[0].outerHTML;
        attendancePercentage.innerHTML = '';
        studentImageInput.value = '';
    });
});
