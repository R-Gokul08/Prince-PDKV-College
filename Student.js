document.addEventListener('DOMContentLoaded', function() {
    // Initialize Supabase client
    const supabase = window.supabase;
    
    // DOM Elements
    const studentForm = document.getElementById('studentForm');
    const studentImageInput = document.getElementById('studentImage');
    const examDetails = document.getElementById('examDetails');
    const addExamBtn = document.getElementById('addExamBtn');
    const totalDays = document.getElementById('totalDays');
    const presentDays = document.getElementById('presentDays');
    const absentDays = document.getElementById('absentDays');
    const attendancePercentage = document.getElementById('attendancePercentage');
    const formSection = document.getElementById('student-form-section');
    const displaySection = document.getElementById('student-display-section');
    const studentProfile = document.getElementById('studentProfile');

    // 1. ✅ ATTENDANCE CALCULATION (Real-time)
    function calculateAttendance() {
        const total = parseInt(totalDays.value) || 0;
        const present = parseInt(presentDays.value) || 0;
        
        if (total > 0 && present <= total) {
            const percentage = ((present / total) * 100).toFixed(2);
            attendancePercentage.innerHTML = `<strong style="color: #4CAF50;">📊 Attendance: ${percentage}%</strong>`;
            absentDays.value = Math.max(0, total - present);
        } else {
            attendancePercentage.innerHTML = '';
        }
    }

    totalDays.addEventListener('input', calculateAttendance);
    presentDays.addEventListener('input', calculateAttendance);

    // 2. ✅ ADD EXAM BUTTON (FIXED - Works perfectly!)
    addExamBtn.addEventListener('click', function() {
        const examEntry = document.createElement('div');
        examEntry.className = 'exam-entry';
        examEntry.innerHTML = `
            <input type="text" class="exam-subject" placeholder="Subject Name">
            <input type="number" class="exam-marks" placeholder="Marks" min="0" max="100">
            <select class="exam-result">
                <option value="">Pass/Fail</option>
                <option value="Pass">✅ Pass</option>
                <option value="Fail">❌ Fail</option>
            </select>
            <select class="exam-type">
                <option value="">Sem/CIA</option>
                <option value="Semester">📚 Semester</option>
                <option value="CIA">📝 CIA</option>
            </select>
            <button type="button" class="remove-exam" onclick="removeExam(this)">❌ Remove</button>
        `;
        examDetails.appendChild(examEntry);
    });

    // 3. ✅ REMOVE EXAM FUNCTION (Global scope)
    window.removeExam = function(button) {
        if (examDetails.children.length > 1) {
            button.parentElement.remove();
        } else {
            alert('⚠️ At least one exam entry required!');
        }
    };

    // 4. ✅ MAIN FORM SUBMISSION (Saves to Supabase + Shows data)
    studentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Show loading state
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '⏳ Saving...';
        submitBtn.disabled = true;

        try {
            // Validate form
            const registerNo = document.getElementById('registerNo').value.trim();
            if (!registerNo) {
                throw new Error('Register number is required!');
            }

            // Format DOB (dd-mm-yyyy)
            const dobInput = document.getElementById('dob').value;
            const dob = dobInput ? new Date(dobInput).toLocaleDateString('en-GB') : '';

            // Collect basic form data
            const formData = {
                name: document.getElementById('studentName').value.trim(),
                guardian_name: document.getElementById('guardianName').value.trim(),
                register_no: registerNo,
                department: document.getElementById('department').value.trim(),
                year: parseInt(document.getElementById('year').value),
                phone: document.getElementById('phone').value.trim(),
                email: document.getElementById('email').value.trim(),
                linkedin: document.getElementById('linkedin').value.trim() || null,
                github: document.getElementById('github').value.trim() || null,
                dob: dob,
                total_days: parseInt(totalDays.value) || 0,
                present_days: parseInt(presentDays.value) || 0,
                absent_days: parseInt(document.getElementById('absentDays').value) || 0,
                attendance_percentage: parseFloat(attendancePercentage.textContent?.match(/[\d.]+/)?.[0] || 0)
            };

            // Collect exam details
            const examEntries = document.querySelectorAll('.exam-entry');
            const exams = [];
            examEntries.forEach(entry => {
                const subject = entry.querySelector('.exam-subject').value.trim();
                const marks = entry.querySelector('.exam-marks').value.trim();
                const result = entry.querySelector('.exam-result').value;
                const type = entry.querySelector('.exam-type').value;
                
                if (subject && marks) {
                    exams.push({
                        subject: subject,
                        marks: parseInt(marks),
                        result: result || 'Not Specified',
                        type: type || 'Not Specified'
                    });
                }
            });
            formData.exam_details = exams.length > 0 ? exams : null;

            // 5. ✅ CHECK DUPLICATE REGISTER NUMBER
            console.log('🔍 Checking duplicate register:', formData.register_no);
            const { data: existingStudent, error: checkError } = await supabase
                .from('student_information')
                .select('register_no')
                .eq('register_no', formData.register_no)
                .maybeSingle();

            if (checkError) {
                console.error('Check error:', checkError);
            }
            
            if (existingStudent) {
                alert('❌ Register number already exists!');
                return;
            }

            // 6. ✅ UPLOAD IMAGE (FIXED - Correct bucket path)
            let imageUrl = null;
            if (studentImageInput.files && studentImageInput.files[0]) {
                const file = studentImageInput.files[0];
                const fileExt = file.name.split('.').pop().toLowerCase();
                const fileName = `Student_images/${formData.register_no}.${fileExt}`;
                
                console.log('📸 Uploading image:', fileName);
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('Image_files')  // ← YOUR BUCKET NAME
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type
                    });

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    // Don't fail completely if image fails - just log
                    console.log('⚠️ Image upload failed, continuing without image...');
                } else {
                    const { data: publicUrl } = supabase.storage
                        .from('Image_files')
                        .getPublicUrl(fileName);
                    imageUrl = publicUrl.publicUrl;
                    console.log('✅ Image uploaded:', imageUrl);
                }
            }

            // 7. ✅ SAVE TO SUPABASE (Final step)
            console.log('💾 Saving student data:', formData);
            const { data: studentData, error: insertError } = await supabase
                .from('student_information')
                .insert([{
                    ...formData,
                    image_url: imageUrl
                }])
                .select()
                .single();

            if (insertError) {
                throw new Error('Database save failed: ' + insertError.message);
            }

            console.log('🎉 Student saved successfully:', studentData);
            
            // 8. ✅ SUCCESS: Hide form, show ONLY this student's data
            formSection.style.display = 'none';
            displaySection.style.display = 'block';
            displayStudentProfile(studentData);

        } catch (error) {
            console.error('❌ Full error:', error);
            alert('❌ Error: ' + error.message);
        } finally {
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // 9. ✅ DISPLAY STUDENT PROFILE (Beautiful card view)
    window.displayStudentProfile = function(student) {
        studentProfile.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="${student.image_url || 'https://via.placeholder.com/150x150/4CAF50/FFFFFF?text=No+Image'}" 
                     alt="${student.name}" 
                     class="student-image"
                     onerror="this.src='https://via.placeholder.com/150x150/4CAF50/FFFFFF?text=Photo'">
                <h3 style="color: #2c3e50; margin: 10px 0;">${student.name}</h3>
                <h4 style="color: #4CAF50; margin: 5px 0;">Reg No: ${student.register_no}</h4>
            </div>
            
            <div class="student-info" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div class="info-item">
                    <div class="info-label">Department</div>
                    <div class="info-value">${student.department}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Year</div>
                    <div class="info-value">${student.year}ᵗʰ Year</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Guardian</div>
                    <div class="info-value">${student.guardian_name}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Phone</div>
                    <div class="info-value">${student.phone}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Email</div>
                    <div class="info-value">${student.email}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Date of Birth</div>
                    <div class="info-value">${student.dob}</div>
                </div>
                ${student.linkedin ? `
                <div class="info-item">
                    <div class="info-label">LinkedIn</div>
                    <div class="info-value"><a href="${student.linkedin}" target="_blank" style="color: #0077B5;">🔗 View Profile</a></div>
                </div>` : ''}
                ${student.github ? `
                <div class="info-item">
                    <div class="info-label">GitHub</div>
                    <div class="info-value"><a href="${student.github}" target="_blank" style="color: #333;">🔗 View Profile</a></div>
                </div>` : ''}
            </div>
            
            <div class="attendance-grid" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 15px; margin: 20px 0; color: white;">
                <h3 style="margin-top: 0;">📅 Attendance</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                    <div class="info-item" style="background: rgba(255,255,255,0.2);">
                        <div style="font-weight: bold;">${student.attendance_percentage}%</div>
                        <div>Attendance</div>
                    </div>
                    <div class="info-item" style="background: rgba(255,255,255,0.2);">
                        <div>${student.present_days}/${student.total_days}</div>
                        <div>Present/Total</div>
                    </div>
                    <div class="info-item" style="background: rgba(255,255,255,0.2);">
                        <div>${student.absent_days}</div>
                        <div>Absent</div>
                    </div>
                </div>
            </div>
            
            ${student.exam_details && student.exam_details.length > 0 ? `
            <div class="exams-grid" style="margin-top: 25px;">
                <h3>📊 Exam Results</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    ${student.exam_details.map(exam => `
                    <div class="info-item" style="border-left: 4px solid ${exam.result === 'Pass' ? '#4CAF50' : '#f44336'};">
                        <div class="info-label">${exam.subject}</div>
                        <div class="info-value">${exam.marks}/100 - ${exam.result} (${exam.type})</div>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : `
            <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 15px; margin: 25px 0;">
                <p style="color: #6c757d; font-size: 18px;">📝 No exam details added</p>
            </div>
            `}
            
            <button onclick="resetForm()" 
                    style="background: linear-gradient(45deg, #f44336, #d32f2f); color: white; border: none; padding: 15px 40px; border-radius: 25px; font-size: 16px; cursor: pointer; width: 100%; margin-top: 20px; font-weight: bold;">
                ➕ Add Another Student
            </button>
        `;
    };

    // 10. ✅ RESET FORM FUNCTION
    window.resetForm = function() {
        formSection.style.display = 'block';
        displaySection.style.display = 'none';
        studentForm.reset();
        attendancePercentage.innerHTML = '';
        
        // Reset exam entries to 1
        examDetails.innerHTML = `
            <div class="exam-entry">
                <input type="text" class="exam-subject" placeholder="Subject Name">
                <input type="number" class="exam-marks" placeholder="Marks" min="0" max="100">
                <select class="exam-result">
                    <option value="">Pass/Fail</option>
                    <option value="Pass">✅ Pass</option>
                    <option value="Fail">❌ Fail</option>
                </select>
                <select class="exam-type">
                    <option value="">Sem/CIA</option>
                    <option value="Semester">📚 Semester</option>
                    <option value="CIA">📝 CIA</option>
                </select>
                <button type="button" class="remove-exam" onclick="removeExam(this)">❌ Remove</button>
            </div>
        `;
        
        studentImageInput.value = '';
    };

    console.log('✅ Student form initialized successfully!');
});
