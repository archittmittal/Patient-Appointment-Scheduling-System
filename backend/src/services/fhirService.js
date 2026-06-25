/**
 * FHIR Service
 * Maps database entities to HL7 FHIR R4 resources.
 */

/**
 * Maps a database Patient to a FHIR R4 Patient resource
 * @param {Object} patient - Database patient record (joined with user table for email)
 * @returns {Object|null} FHIR Patient resource
 */
function toFhirPatient(patient) {
    if (!patient) return null;
    
    return {
        resourceType: "Patient",
        id: String(patient.id),
        active: true,
        name: [{
            use: "official",
            family: patient.last_name || "",
            given: [patient.first_name || ""]
        }],
        telecom: [
            ...(patient.phone ? [{ system: "phone", value: patient.phone, use: "mobile" }] : []),
            ...(patient.email ? [{ system: "email", value: patient.email }] : [])
        ],
        birthDate: patient.dob ? new Date(patient.dob).toISOString().split('T')[0] : undefined,
        address: patient.address ? [{ text: patient.address }] : undefined,
        identifier: [
            ...(patient.abha_id ? [{ system: "https://ndhm.gov.in/abha-id", value: patient.abha_id }] : []),
            ...(patient.abha_number ? [{ system: "https://ndhm.gov.in/abha-number", value: patient.abha_number }] : [])
        ].filter(Boolean)
    };
}

/**
 * Maps a database Patient Vitals record to a FHIR R4 Observation resource
 * @param {Object} vitals - Database patient vitals record
 * @param {Object} patient - Database patient record
 * @returns {Object|null} FHIR Observation resource
 */
function toFhirObservation(vitals, patient) {
    if (!vitals) return null;
    
    const components = [];
    
    if (vitals.weight_kg != null) {
        components.push({
            code: {
                coding: [{
                    system: "http://loinc.org",
                    code: "29463-7",
                    display: "Body weight"
                }]
            },
            valueQuantity: {
                value: Number(vitals.weight_kg),
                unit: "kg",
                system: "http://unitsofmeasure.org",
                code: "kg"
            }
        });
    }
    
    if (vitals.height_cm != null) {
        components.push({
            code: {
                coding: [{
                    system: "http://loinc.org",
                    code: "8302-2",
                    display: "Body height"
                }]
            },
            valueQuantity: {
                value: Number(vitals.height_cm),
                unit: "cm",
                system: "http://unitsofmeasure.org",
                code: "cm"
            }
        });
    }
    
    if (vitals.blood_pressure_sys != null) {
        components.push({
            code: {
                coding: [{
                    system: "http://loinc.org",
                    code: "8480-6",
                    display: "Systolic blood pressure"
                }]
            },
            valueQuantity: {
                value: Number(vitals.blood_pressure_sys),
                unit: "mmHg",
                system: "http://unitsofmeasure.org",
                code: "mm[Hg]"
            }
        });
    }
    
    if (vitals.blood_pressure_dia != null) {
        components.push({
            code: {
                coding: [{
                    system: "http://loinc.org",
                    code: "8462-4",
                    display: "Diastolic blood pressure"
                }]
            },
            valueQuantity: {
                value: Number(vitals.blood_pressure_dia),
                unit: "mmHg",
                system: "http://unitsofmeasure.org",
                code: "mm[Hg]"
            }
        });
    }
    
    if (vitals.heart_rate != null) {
        components.push({
            code: {
                coding: [{
                    system: "http://loinc.org",
                    code: "8867-4",
                    display: "Heart rate"
                }]
            },
            valueQuantity: {
                value: Number(vitals.heart_rate),
                unit: "/min",
                system: "http://unitsofmeasure.org",
                code: "/min"
            }
        });
    }
    
    if (vitals.temperature_c != null) {
        components.push({
            code: {
                coding: [{
                    system: "http://loinc.org",
                    code: "8310-5",
                    display: "Body temperature"
                }]
            },
            valueQuantity: {
                value: Number(vitals.temperature_c),
                unit: "C",
                system: "http://unitsofmeasure.org",
                code: "Cel"
            }
        });
    }
    
    if (vitals.spo2 != null) {
        components.push({
            code: {
                coding: [{
                    system: "http://loinc.org",
                    code: "2708-6",
                    display: "Oxygen saturation"
                }]
            },
            valueQuantity: {
                value: Number(vitals.spo2),
                unit: "%",
                system: "http://unitsofmeasure.org",
                code: "%"
            }
        });
    }

    return {
        resourceType: "Observation",
        id: String(vitals.id),
        status: "final",
        category: [{
            coding: [{
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "vital-signs",
                display: "Vital Signs"
            }]
        }],
        code: {
            coding: [{
                system: "http://loinc.org",
                code: "85353-1",
                display: "Vital signs, weight, height, head circumference, oxygen saturation & BP panel"
            }],
            text: "Vital Signs Panel"
        },
        subject: patient ? { reference: `Patient/${patient.id}` } : undefined,
        effectiveDateTime: vitals.recorded_at ? new Date(vitals.recorded_at).toISOString() : new Date().toISOString(),
        component: components
    };
}

/**
 * Maps a database Prescription record to a FHIR R4 MedicationStatement resource
 * @param {Object} prescription - Database prescription record
 * @param {Object} patient - Database patient record
 * @returns {Object|null} FHIR MedicationStatement resource
 */
function toFhirMedicationStatement(prescription, patient) {
    if (!prescription) return null;
    
    const dosageInfo = {};
    if (prescription.dosage) {
        dosageInfo.text = prescription.dosage;
    }
    if (prescription.frequency) {
        dosageInfo.timing = {
            repeat: {
                frequency: 1,
                period: 1,
                periodUnit: "d"
            }
        };
        const freqText = prescription.frequency.toLowerCase();
        if (freqText.includes("twice") || freqText.includes("2x") || freqText.includes("bid")) {
            dosageInfo.timing.repeat.frequency = 2;
        } else if (freqText.includes("three") || freqText.includes("3x") || freqText.includes("tid")) {
            dosageInfo.timing.repeat.frequency = 3;
        } else if (freqText.includes("four") || freqText.includes("4x") || freqText.includes("qid")) {
            dosageInfo.timing.repeat.frequency = 4;
        }
    }
    if (prescription.duration_days) {
        if (!dosageInfo.timing) dosageInfo.timing = { repeat: {} };
        dosageInfo.timing.repeat.boundsDuration = {
            value: Number(prescription.duration_days),
            unit: "days",
            system: "http://unitsofmeasure.org",
            code: "d"
        };
    }

    return {
        resourceType: "MedicationStatement",
        id: String(prescription.id),
        status: prescription.is_active ? "active" : "completed",
        medicationCodeableConcept: {
            text: prescription.medications || ""
        },
        subject: patient ? { reference: `Patient/${patient.id}` } : undefined,
        dateAsserted: prescription.date_prescribed ? new Date(prescription.date_prescribed).toISOString() : new Date().toISOString(),
        note: prescription.instructions ? [{ text: prescription.instructions }] : undefined,
        dosage: Object.keys(dosageInfo).length > 0 ? [dosageInfo] : undefined
    };
}

/**
 * Packs mapped FHIR resources into a FHIR R4 Bundle
 * @param {Object} prescription - Database prescription record
 * @param {Object} vitals - Database patient vitals record
 * @param {Object} patient - Database patient record
 * @returns {Object} FHIR Bundle collection
 */
function toFhirBundle(prescription, vitals, patient) {
    const entries = [];
    
    const patientRes = toFhirPatient(patient);
    if (patientRes) {
        entries.push({
            fullUrl: `urn:uuid:patient-${patientRes.id}`,
            resource: patientRes
        });
    }
    
    const medicationRes = toFhirMedicationStatement(prescription, patient);
    if (medicationRes) {
        entries.push({
            fullUrl: `urn:uuid:medicationstatement-${medicationRes.id}`,
            resource: medicationRes
        });
    }
    
    const observationRes = toFhirObservation(vitals, patient);
    if (observationRes) {
        entries.push({
            fullUrl: `urn:uuid:observation-${observationRes.id}`,
            resource: observationRes
        });
    }

    return {
        resourceType: "Bundle",
        id: `bundle-${prescription ? prescription.id : 'unknown'}`,
        type: "collection",
        entry: entries
    };
}

module.exports = {
    toFhirPatient,
    toFhirObservation,
    toFhirMedicationStatement,
    toFhirBundle
};
