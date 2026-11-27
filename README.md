
flowchart TD
    A([START]) --> B[Open TVACHA.AI]
    B --> C[Load Web Application]
    C --> D[Initialize Interface and Scripts]
    D --> E[/Upload Skin Image/]

    E --> F[Validate Image Format and Size]
    F --> G{Image Valid?}

    G -->|No| H[Display Error Message]
    H --> E

    G -->|Yes| I[Prepare Image for Processing]
    I --> J[Generate SHA-256 Hash]
    J --> K[Load Established Results Registry]
    K --> L[Compare Uploaded Image with Reference Images]

    L --> M{Exact Hash Match Found?}

    M -->|Yes| N[Fetch Matching result.json]
    N --> O[Load Established Reference Result]

    M -->|No| P[Collect Optional User Context]
    P --> Q[Prepare API Request]
    Q --> R[/Send POST Request to Cloudflare Worker/]

    R --> S[Validate Request and Consent]
    S --> T{Request Valid?}

    T -->|No| U[Return Error Response]
    U --> V[Display Appropriate Error]

    T -->|Yes| W[Read AI Provider Configuration]
    W --> X{AI API Available?}

    X -->|Yes| Y[Send Image and Context to AI Provider]
    Y --> Z[Receive AI Response]
    Z --> AA[Process and Structure Response]

    X -->|No| AB[Use Configured Demo Fallback]
    AB --> AA

    AA --> AC[Generate AI Assessment Report]

    O --> AD[Render Assessment]
    AC --> AD

    AD --> AE[/Display Report to User/]
    AE --> AF[Show Medical Disclaimer and Guidance]
    AF --> AG([END])

    style A fill:#DDEFE8,stroke:#26765B,color:#174D3A
    style AG fill:#DDEFE8,stroke:#26765B,color:#174D3A
    style G fill:#FFF0D7,stroke:#B77A25,color:#754A14
    style M fill:#FFF0D7,stroke:#B77A25,color:#754A14
    style T fill:#FFF0D7,stroke:#B77A25,color:#754A14
    style X fill:#FFF0D7,stroke:#B77A25,color:#754A14
    style R fill:#F1E8FA,stroke:#8056A5,color:#583779
